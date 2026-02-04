import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import Razorpay from 'razorpay';
import { validateWebhookSignature } from 'razorpay/dist/utils/razorpay-utils';
import { getSecret } from '../shared/secrets';
import { createResponse, safeJsonParse } from '../shared/utils';
import { docClient } from '../shared/dynamo';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { PRICING_CONFIG, RazorpayOrderRequest, RazorpaySubscriptionRequest } from '../shared/types';
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
            const { amountMain, currency } = body as RazorpayOrderRequest;

            if (!amountMain || !currency) {
                return createResponse(400, { message: 'Missing amount or currency' }, origin);
            }

            // Smallest Unit Calculation
            // INR: 1 INR = 100 paise
            // USD: 1 USD = 100 cents
            const amountSmallest = Math.round(amountMain * 100);

            const options = {
                amount: amountSmallest,
                currency: currency,
                receipt: `rcpt_${userId}_${Date.now()}`,
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
            const { planId } = body as RazorpaySubscriptionRequest; // 'plan_monthly_inr' etc. provided by logic

            if (!planId) return createResponse(400, { message: 'Missing planId' }, origin);

            // TODO: Create Customer if strictly needed, but Razorpay allows creating sub without cust ID initially 
            // strictly for simple flows, but for recurring, it auto-creates or we pass it? 
            // Best practice: Create flow usually involves frontend calling backend. 
            // Razorpay Node SDK `subscriptions.create`

            const sub = await rzp.subscriptions.create({
                plan_id: planId,
                customer_notify: 1,
                total_count: 1200, // 100 years? Or indefinite? Razorpay max count. 
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
                // Razorpay sends payment.captured for subs too? 
                // Check notes.
                if (notes?.type === 'CREDIT_PACK') {
                    const userId = notes.userId;
                    const amountPaid = payment.amount / 100; // In main unit
                    const currency = payment.currency;

                    // Calculate Credits
                    let creditsToAdd = 0;
                    if (currency === 'INR') {
                        creditsToAdd = amountPaid; // 1 INR = 1 Credit
                        if (amountPaid >= 100) creditsToAdd *= 1.05; // 5% Bonus logic if needed
                    } else if (currency === 'USD') {
                        creditsToAdd = amountPaid * 50; // $1 = 50 Credits
                    }

                    console.log(`Adding ${creditsToAdd} credits to user ${userId}`);

                    await docClient.send(new UpdateCommand({
                        TableName: USERS_TABLE,
                        Key: { userId },
                        UpdateExpression: 'SET credits = if_not_exists(credits, :zero) + :val, updatedAt = :now',
                        ExpressionAttributeValues: {
                            ':zero': 0,
                            ':val': creditsToAdd,
                            ':now': new Date().toISOString()
                        }
                    }));
                }
            } else if (eventType === 'subscription.charged') {
                const sub = data.subscription.entity;
                const payment = data.payment.entity;
                const userId = sub.notes?.userId;

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

        }));
    }

            return createResponse(200, { status: 'ok' });
}

// 4. Verify Payment Signature (Frontend Callback)
if (path.endsWith('/verify') && method === 'POST') {
    const body = safeJsonParse(event.body);
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return createResponse(400, { message: 'Missing required parameters' }, origin);
    }

    const keySecret = await getSecret('PARAM_RAZORPAY_KEY_SECRET');
    if (!keySecret) throw new Error('Razorpay secret missing');

    const generated_signature = crypto
        .createHmac('sha256', keySecret)
        .update(razorpay_order_id + "|" + razorpay_payment_id)
        .digest('hex');

    if (generated_signature === razorpay_signature) {
        return createResponse(200, { status: 'valid' }, origin);
    } else {
        return createResponse(400, { message: 'Invalid signature' }, origin);
    }
}

return createResponse(404, { message: 'Not Found' }, origin);

    } catch (err: any) {
    console.error('Razorpay Handler Error:', err);
    return createResponse(500, { message: err.message }, origin);
}
};
