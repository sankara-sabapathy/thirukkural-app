import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import Razorpay from 'razorpay';
import { validateWebhookSignature } from 'razorpay/dist/utils/razorpay-utils';
import { getSecret } from '../shared/secrets';
import { createResponse, safeJsonParse } from '../shared/utils';
import { docClient } from '../shared/dynamo';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { PRICING_CONFIG, RazorpayOrderRequest, RazorpaySubscriptionRequest, UserProfile } from '../shared/types';
import * as crypto from 'crypto';

const USERS_TABLE = process.env.USERS_TABLE;

// Initialize Razorpay lazily to ensure secrets are fetched
let razorpay: Razorpay | null = null;
let webhookSecret: string | null = null;

const getRazorpayClient = async () => {
    if (razorpay) return razorpay;

    const keyId = await getSecret('PARAM_RAZORPAY_KEY_ID');
    const keySecret = await getSecret('PARAM_RAZORPAY_KEY_SECRET');
    webhookSecret = await getSecret('PARAM_RAZORPAY_WEBHOOK_SECRET') || null;

    if (!keyId || !keySecret) {
        throw new Error('Razorpay credentials not configured');
    }

    razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
    });
    return razorpay;
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const origin = event.headers?.origin || event.headers?.Origin;
    const path = event.path; // e.g., /payment/order
    const method = event.httpMethod;

    try {
        const rzp = await getRazorpayClient();

        // 1. Create Order (Credits)
        if (path.endsWith('/order') && method === 'POST') {
            const userId = event.requestContext.authorizer?.claims?.sub;
            if (!userId) return createResponse(401, { message: 'Unauthorized' }, origin);

            const body = safeJsonParse(event.body);
            const { amount, currency } = body as RazorpayOrderRequest;

            if (!amount || !currency) {
                return createResponse(400, { message: 'Missing amount or currency' }, origin);
            }

            // Amount is already in smallest unit (paise/cents)
            const amountSmallest = amount;

            const options = {
                amount: amountSmallest,
                currency: currency,
                // Razorpay receipt length max 40 chars.
                // "rcpt_" (5) + userId (36) + "_" (1) + timestamp (13) = 55 chars (Too long).
                // "rcpt_" (5) + shortUser (8) + "_" (1) + timestamp (13) = 27 chars (Safe).
                receipt: `rcpt_${userId.substring(0, 8)}_${Date.now()}`,
                notes: {
                    userId: userId,
                    type: 'CREDIT_PACK'
                }
            };

            const order = await rzp.orders.create(options);
            return createResponse(200, order, origin);
        }

        // 2. Create Subscription
        if (path.endsWith('/subscription') && method === 'POST') {
            const userId = event.requestContext.authorizer?.claims?.sub;
            if (!userId) return createResponse(401, { message: 'Unauthorized' }, origin);

            const body = safeJsonParse(event.body);
            const { planId, totalCount } = body as RazorpaySubscriptionRequest; // 'plan_monthly_inr' etc. provided by logic

            if (!planId) return createResponse(400, { message: 'Missing planId' }, origin);

            // Validate totalCount
            let safeTotalCount = Number(totalCount);
            if (!Number.isInteger(safeTotalCount) || safeTotalCount < 1 || safeTotalCount > 1200) {
                console.warn(`[Create Sub] Invalid totalCount '${totalCount}', defaulting to 60`);
                safeTotalCount = 60; // Default to 5 years
            }

            // TODO: Create Customer if strictly needed, but Razorpay allows creating sub without cust ID initially 
            // strictly for simple flows, but for recurring, it auto-creates or we pass it? 
            // Best practice: Create flow usually involves frontend calling backend. 
            // Razorpay Node SDK `subscriptions.create`

            const sub = await rzp.subscriptions.create({
                plan_id: planId,
                customer_notify: 1,
                total_count: safeTotalCount,
                // Creating indefinite sub:
                // total_count: 12 (1 year) or large number.
                notes: {
                    userId: userId,
                    type: 'SUBSCRIPTION'
                }
            });

            return createResponse(200, sub, origin);
        }

        // 3. Webhook
        if (path.endsWith('/webhook') && method === 'POST') {
            const signature = event.headers['x-razorpay-signature'];
            if (!signature || !webhookSecret) {
                console.error('Missing signature or secret');
                return createResponse(400, { message: 'Invalid signature' });
            }

            // Verify Signature
            const isValid = validateWebhookSignature(event.body || '', signature, webhookSecret);
            if (!isValid) {
                console.error('Invalid signature check');
                return createResponse(400, { message: 'Invalid signature' });
            }

            const payload = safeJsonParse(event.body);
            const eventType = payload.event;
            const data = payload.payload;

            console.log(`Received Webhook: ${eventType}`);

            if (eventType === 'payment.captured') {
                const payment = data.payment.entity;
                const notes = payment.notes;

                // Only handle CREDIT_PACK here. Subscriptions handled by subscription events?
                if (notes?.type === 'CREDIT_PACK') {
                    const userId = notes.userId;
                    if (!userId) {
                        console.warn('User ID missing in payment.captured event');
                        return createResponse(200, { status: 'ignored_missing_user' });
                    }

                    const amountPaid = payment.amount / 100; // In main unit
                    const currency = payment.currency;
                    const paymentId = payment.id;

                    // Calculate Credits
                    let creditsToAdd = 0;
                    if (currency === 'INR') {
                        creditsToAdd = amountPaid; // 1 INR = 1 Credit
                        if (amountPaid >= 100) creditsToAdd *= 1.05; // 5% Bonus logic
                    } else if (currency === 'USD') {
                        creditsToAdd = amountPaid * 50; // $1 = 50 Credits
                    }

                    console.log(`Adding ${creditsToAdd} credits to user ${userId} for payment ${paymentId}`);

                    try {
                        await docClient.send(new UpdateCommand({
                            TableName: USERS_TABLE,
                            Key: { userId },
                            // Atomic add credits AND record payment ID to prevent double processing
                            UpdateExpression: 'ADD processedPayments :pid_set SET credits = if_not_exists(credits, :zero) + :val, updatedAt = :now',
                            ConditionExpression: 'NOT contains(processedPayments, :pid)',
                            ExpressionAttributeValues: {
                                ':zero': 0,
                                ':val': creditsToAdd,
                                ':now': new Date().toISOString(),
                                ':pid': paymentId,
                                ':pid_set': new Set([paymentId])
                            }
                        }));
                    } catch (err: any) {
                        if (err.name === 'ConditionalCheckFailedException') {
                            console.log(`Payment ${paymentId} already processed for user ${userId}`);
                            return createResponse(200, { status: 'already_processed' });
                        }
                        throw err;
                    }
                }
            } else if (eventType === 'subscription.charged') {
                const sub = data.subscription.entity;
                const payment = data.payment.entity;
                const userId = sub.notes?.userId;

                if (!userId) {
                    console.warn(`User ID missing in subscription.charged event. Sub ID: ${sub.id}`);
                    return createResponse(200, { status: 'ignored_missing_user' });
                }

                console.log(`Subscription charged for user ${userId}`);

                await docClient.send(new UpdateCommand({
                    TableName: USERS_TABLE,
                    Key: { userId },
                    UpdateExpression: 'SET subscriptionStatus = :status, subscriptionId = :subId, subscriptionExpiry = :expiry, subscriptionPlan = :plan, updatedAt = :now',
                    ExpressionAttributeValues: {
                        ':status': 'active',
                        ':subId': sub.id,
                        ':expiry': new Date(sub.current_end * 1000).toISOString(), // Razorpay sends unix timestamp
                        ':plan': sub.plan_id.includes('monthly') ? 'monthly' : 'yearly', // Simple heuristic
                        ':now': new Date().toISOString()
                    }
                }));
            } else if (eventType === 'subscription.cancelled' || eventType === 'subscription.halted') {
                const sub = data.subscription.entity;
                const userId = sub.notes?.userId;

                if (!userId) {
                    console.warn(`User ID missing in subscription event ${eventType}. Sub ID: ${sub.id}`);
                    return createResponse(200, { status: 'ignored_missing_user' });
                }

                await docClient.send(new UpdateCommand({
                    TableName: USERS_TABLE,
                    Key: { userId },
                    UpdateExpression: 'SET subscriptionStatus = :status, updatedAt = :now',
                    ExpressionAttributeValues: {
                        ':status': sub.status, // cancelled/halted
                        ':now': new Date().toISOString()
                    }
                }));
            }

            return createResponse(200, { status: 'ok' });
        }

        // 4. Verify Payment Signature (Frontend Callback)
        if (path.endsWith('/verify') && method === 'POST') {
            const body = safeJsonParse(event.body);
            const userId = event.requestContext.authorizer?.claims?.sub; // Ensure we know WHO is verifying
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature, razorpay_subscription_id } = body;

            if (!razorpay_payment_id || !razorpay_signature) {
                return createResponse(400, { message: 'Missing required parameters' }, origin);
            }

            const keySecret = await getSecret('PARAM_RAZORPAY_KEY_SECRET');
            if (!keySecret) throw new Error('Razorpay secret missing');

            let generated_signature = '';
            if (razorpay_subscription_id) {
                // Subscription Verification
                generated_signature = crypto
                    .createHmac('sha256', keySecret)
                    .update(razorpay_payment_id + "|" + razorpay_subscription_id)
                    .digest('hex');
            } else if (razorpay_order_id) {
                // Order Verification
                generated_signature = crypto
                    .createHmac('sha256', keySecret)
                    .update(razorpay_order_id + "|" + razorpay_payment_id)
                    .digest('hex');
            } else {
                return createResponse(400, { message: 'Missing order_id or subscription_id' }, origin);
            }

            // Non-secret logging for signature verification
            console.log(`[Verify] Validating signature for payment: ${razorpay_payment_id}`);

            let isValidSignature = false;
            try {
                if (generated_signature.length === razorpay_signature.length) {
                    isValidSignature = crypto.timingSafeEqual(
                        Buffer.from(generated_signature),
                        Buffer.from(razorpay_signature)
                    );
                }
            } catch (e) {
                console.error('[Verify] Signature comparison error', e);
            }

            if (isValidSignature) {
                // SUCCESS! 
                // Now, if it's a subscription, let's fetch details and update DB immediately 
                // to avoid race condition where UI redirects before Webhook arrives.

                if (razorpay_subscription_id && userId) {
                    try {
                        const sub = await rzp.subscriptions.fetch(razorpay_subscription_id);
                        console.log(`[Verify] Fetched Subscription ${sub.id} Status: ${sub.status}`);

                        // Verify ownership to prevent account takeover via subscription ID reassignment
                        if (sub.notes?.userId !== userId) {
                            console.error(`[Verify] Ownership mismatch! Subscription userId ${sub.notes?.userId} !== Request userId ${userId}`);
                            return createResponse(403, { message: 'Subscription ownership mismatch' }, origin);
                        }

                        // Accept 'authenticated' as it means the auth transaction (payment) succeeded
                        if (sub.status === 'active' || sub.status === 'authenticated') {
                            console.log(`[Verify] Immediate update for subscription ${razorpay_subscription_id}`);
                            const updateResult = await docClient.send(new UpdateCommand({
                                TableName: USERS_TABLE,
                                Key: { userId },
                                UpdateExpression: 'SET subscriptionStatus = :status, subscriptionId = :subId, subscriptionExpiry = :expiry, subscriptionPlan = :plan, updatedAt = :now',
                                ExpressionAttributeValues: {
                                    ':status': 'active', // Force active in our DB if authenticated
                                    ':subId': sub.id,
                                    ':expiry': sub.current_end ? new Date(sub.current_end * 1000).toISOString() : null,
                                    ':plan': sub.plan_id ? (sub.plan_id.includes('monthly') ? 'monthly' : 'yearly') : 'yearly',
                                    ':now': new Date().toISOString()
                                },
                                ReturnValues: 'UPDATED_NEW'
                            }));

                            // Clean response logic: Return only non-PII fields.
                            // The attributes object from 'UPDATED_NEW' already contains only the fields that were updated.
                            return createResponse(200, { status: 'valid', updatedUser: updateResult.Attributes }, origin);
                        } else {
                            console.warn(`[Verify] Subscription status '${sub.status}' not active/authenticated. DB not updated immediately.`);
                        }
                    } catch (e: any) {
                        console.error('[Verify] Failed to fetch/update subscription', e);
                        // Convert ReferenceError/Auth error to non-blocking? 
                        // If this fails, we still return valid signature, letting Webhook handle it.
                    }
                }

                return createResponse(200, { status: 'valid' }, origin);
            } else {
                return createResponse(400, { message: 'Invalid signature' }, origin);
            }
        }

        // 5. Cancel Subscription
        if (path.endsWith('/cancel') && method === 'POST') {
            const userId = event.requestContext.authorizer?.claims?.sub;
            if (!userId) return createResponse(401, { message: 'Unauthorized' }, origin);

            // Fetch user's subscription ID from DB
            const userResult = await docClient.send(new GetCommand({
                TableName: USERS_TABLE,
                Key: { userId }
            }));

            const user = userResult.Item as UserProfile;
            if (!user || !user.subscriptionId || user.subscriptionStatus !== 'active') {
                return createResponse(400, { message: 'No active subscription found to cancel' }, origin);
            }

            // Cancel on Razorpay (cancel_at_cycle_end=0 -> immediate)
            try {
                // Razorpay cancellation usually returns the updated subscription object
                await rzp.subscriptions.cancel(user.subscriptionId, false);
            } catch (rzpErr: any) {
                console.error('Razorpay Cancellation Failed:', rzpErr);
                // Even if Razorpay fails (e.g. already cancelled), we might want to sync local state?
                // But safer to return error.
                return createResponse(500, { message: 'Failed to cancel subscription with provider', details: rzpErr.error }, origin);
            }

            // Update DB Status immediately
            await docClient.send(new UpdateCommand({
                TableName: USERS_TABLE,
                Key: { userId },
                UpdateExpression: 'SET subscriptionStatus = :status, updatedAt = :now',
                ExpressionAttributeValues: {
                    ':status': 'cancelled',
                    ':now': new Date().toISOString()
                }
            }));

            return createResponse(200, { status: 'cancelled' }, origin);
        }

        return createResponse(404, { message: 'Not Found' }, origin);

    } catch (err: any) {
        console.error('Razorpay Handler Error:', err);
        return createResponse(500, { message: err.message }, origin);
    }
};

