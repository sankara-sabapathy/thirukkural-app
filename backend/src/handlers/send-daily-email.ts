import { ScanCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo';
import { createResponse, safeJsonParse } from '../shared/utils';
import { generateKuralEmail, Kural } from '../shared/email-templates';
import { getRandomKural } from '../shared/kural-utils';
import { sendEmail } from '../shared/email-service';
import { generateUnsubscribeToken } from '../shared/crypto-utils';
import { getSecret } from '../shared/secrets';
import { generateSystemEmail } from '../shared/email-templates';
import * as webpush from 'web-push';
import { PRICING_CONFIG } from '../shared/types';


export const handler = async (): Promise<void> => {
    try {
        // 1. Get all users who want daily emails
        const usersResult = await docClient.send(new ScanCommand({
            TableName: process.env.USERS_TABLE,
            FilterExpression: 'receiveDailyEmail = :rde',
            ExpressionAttributeValues: { ':rde': true }
        }));

        const users = usersResult.Items ?? [];

        // 2. Pick a random Kural
        const randomKural = await getRandomKural();

        if (!randomKural) {
            console.error('Failed to fetch random Kural from database');
            return;
        }

        // Construct rich email content using shared template

        const kuralData: Kural = {
            kuralId: randomKural.kuralId,
            line1: randomKural.line1,
            line2: randomKural.line2,
            translation: randomKural.translation,
            explanation: randomKural.explanation || randomKural.mv || randomKural.sp,
            couplet: randomKural.couplet,
            transliteration: (randomKural.line1_tl && randomKural.line2_tl)
                ? `${randomKural.line1_tl}\n${randomKural.line2_tl}`
                : randomKural.transliteration,
            mk: randomKural.mk,
            mv: randomKural.mv,
            sp: randomKural.sp,
            pal: randomKural.pal,
            iyal: randomKural.iyal,
            adikaram: randomKural.adikaram,
            parimela: safeJsonParse(randomKural.parimela),
            manikudavar: safeJsonParse(randomKural.manikudavar),
            v_munusami: safeJsonParse(randomKural.v_munusami),
            mu_varatha: safeJsonParse(randomKural.mu_varatha),
            mu_karu: safeJsonParse(randomKural.mu_karu),
            salaman: safeJsonParse(randomKural.salaman)
        };

        // 3. Send email to each user with delay
        if (users.length > 0) {
            console.log(`Sending Kural ${kuralData.kuralId} to ${users.length} users via Email`);

            // Check Environment Flag (Beta Mode / Prod Free Mode)
            const enablePayments = process.env.ENABLE_PAYMENTS === 'true';

            for (const user of users) {
                const email = user.email;
                if (!email) continue;

                const userId = user.userId;
                // PII Safety: Use userId for logs, or masked email only if necessary
                const logId = `User ${userId}`;

                // Payment Logic Check
                const hasActiveSub = user.subscriptionStatus === 'active';
                const credits = user.credits !== undefined ? user.credits : 0;
                const region = user.region || 'IN'; // Default to IN
                // Calculate dynamic cost based on region
                // Fallback to IN if region not found in config (shouldn't happen with defaults)
                const regionConfig = PRICING_CONFIG[region as keyof typeof PRICING_CONFIG] || PRICING_CONFIG['IN'];
                const emailCost = regionConfig.creditCost;

                const LOW_CREDIT_THRESHOLD = 5.0;

                let shouldSend = false;
                let creditsDeducted = false;
                let newBalance: number | undefined = undefined;

                if (!enablePayments) {
                    // BETA ACCESS: Send to everyone, no credit deduction
                    shouldSend = true;
                } else if (hasActiveSub) {
                    shouldSend = true;
                } else {
                    // Credit Deduction Mode: Attempt Atomic Deduction FIRST
                    try {
                        const updateResult = await docClient.send(new UpdateCommand({
                            TableName: process.env.USERS_TABLE,
                            Key: { userId },
                            UpdateExpression: 'SET credits = credits - :cost, updatedAt = :now',
                            ConditionExpression: 'credits >= :cost',
                            ExpressionAttributeValues: {
                                ':cost': emailCost,
                                ':now': new Date().toISOString()
                            },
                            ReturnValues: 'ALL_NEW'
                        }));

                        // Deduction Successful
                        creditsDeducted = true;
                        shouldSend = true;
                        newBalance = updateResult.Attributes?.credits;

                    } catch (err: any) {
                        if (err.name === 'ConditionalCheckFailedException') {
                            console.log(`Skipping ${logId}: Insufficient credits (${credits})`);

                            // Logic: Out of Credit Alert (Delivery Skipped)
                            if (!user.outOfCreditAlertSent) {
                                console.log(`Attempting to claim and send Out of Credit Alert for ${logId}`);
                                try {
                                    // 1. Atomic Claim: Lock to prevent spam across concurrent worker lambda invocations
                                    await docClient.send(new UpdateCommand({
                                        TableName: process.env.USERS_TABLE,
                                        Key: { userId },
                                        UpdateExpression: 'SET outOfCreditAlertSent = :t, updatedAt = :now',
                                        ConditionExpression: 'attribute_not_exists(outOfCreditAlertSent) OR outOfCreditAlertSent = :f',
                                        ExpressionAttributeValues: {
                                            ':t': true,
                                            ':f': false,
                                            ':now': new Date().toISOString()
                                        }
                                    }));

                                    // 2. Dispatch Email
                                    try {
                                        const alertEmail = generateSystemEmail({ type: 'OUT_OF_CREDITS' });
                                        await sendEmail({
                                            to: [email],
                                            subject: alertEmail.subject,
                                            text: alertEmail.text,
                                            html: alertEmail.html
                                        });
                                        console.log(`Successfully dispatched Out of Credit Alert for ${logId}`);
                                    } catch (alertErr) {
                                        console.error(`Failed to send Out of Credit alert to ${logId}. Rolling back flag.`, alertErr);
                                        // 3. Rollback if dispatch fails so it can be retried tomorrow
                                        try {
                                            await docClient.send(new UpdateCommand({
                                                TableName: process.env.USERS_TABLE,
                                                Key: { userId },
                                                UpdateExpression: 'SET outOfCreditAlertSent = :f, updatedAt = :u',
                                                ExpressionAttributeValues: {
                                                    ':f': false,
                                                    ':u': new Date().toISOString()
                                                }
                                            }));
                                        } catch (rollbackErr) {
                                            console.error(`Failed to rollback outOfCreditAlertSent for ${logId}`, rollbackErr);
                                        }
                                    }

                                } catch (claimErr: any) {
                                    if (claimErr.name === 'ConditionalCheckFailedException') {
                                        console.log(`Alert already claimed by another worker for ${logId}. Skipping.`);
                                    } else {
                                        console.error(`Failed atomic claim for Out of Credit alert on ${logId}`, claimErr);
                                    }
                                }
                            }

                        } else {
                            console.error(`Error deducting credits for ${logId}`, err);
                        }
                        shouldSend = false;
                    }
                }

                if (shouldSend) {
                    try {
                        // Generate unique secure unsubscribe link
                        const token = await generateUnsubscribeToken(email);
                        const baseDomain = process.env.APP_DOMAIN || 'https://thirukkural.site';
                        const unsubscribeLink = `${baseDomain}/unsubscribe?token=${encodeURIComponent(token)}`;

                        const { subject, text, html } = generateKuralEmail(kuralData, false, unsubscribeLink);

                        await sendEmail({
                            to: [email],
                            subject: subject,
                            text: text,
                            html: html
                        });
                        console.log(`Sent email to ${logId}`);

                        // Logic: Low Credit Alert (Post-Send)
                        if (creditsDeducted && newBalance !== undefined && newBalance < LOW_CREDIT_THRESHOLD && !user.lowCreditAlertSent) {
                            console.log(`Triggering Low Credit Alert for ${logId}`);
                            try {
                                // 1. Atomic claim first
                                await docClient.send(new UpdateCommand({
                                    TableName: process.env.USERS_TABLE,
                                    Key: { userId },
                                    UpdateExpression: 'SET lowCreditAlertSent = :t, updatedAt = :now',
                                    ConditionExpression: 'attribute_not_exists(lowCreditAlertSent) OR lowCreditAlertSent = :f',
                                    ExpressionAttributeValues: {
                                        ':t': true,
                                        ':f': false,
                                        ':now': new Date().toISOString()
                                    }
                                }));

                                // 2. Dispatch
                                try {
                                    const alertEmail = generateSystemEmail({
                                        type: 'LOW_CREDITS',
                                        data: { credits: newBalance }
                                    });
                                    await sendEmail({
                                        to: [email],
                                        subject: alertEmail.subject,
                                        text: alertEmail.text,
                                        html: alertEmail.html
                                    });
                                    console.log(`Successfully dispatched Low Credit Alert for ${logId}`);
                                } catch (e) {
                                    console.error(`Failed to send Low Credit alert to ${logId}. Rolling back flag.`, e);
                                    try {
                                        await docClient.send(new UpdateCommand({
                                            TableName: process.env.USERS_TABLE,
                                            Key: { userId },
                                            UpdateExpression: 'SET lowCreditAlertSent = :f, updatedAt = :u',
                                            ExpressionAttributeValues: {
                                                ':f': false,
                                                ':u': new Date().toISOString()
                                            }
                                        }));
                                    } catch (rollbackErr) {
                                        console.error(`Failed to rollback lowCreditAlertSent for ${logId}`, rollbackErr);
                                    }
                                }
                            } catch (claimErr: any) {
                                if (claimErr.name === 'ConditionalCheckFailedException') {
                                    console.log(`Low credit alert already claimed by another worker for ${logId}. Skipping.`);
                                } else {
                                    console.error(`Failed atomic claim for Low Credit alert on ${logId}`, claimErr);
                                }
                            }
                        }

                        // Wait 1 second to respect limits
                        await new Promise(resolve => setTimeout(resolve, 1000));

                    } catch (e) {
                        console.error(`Failed email for ${logId}`, e);

                        // COMPENSATION: Refund credits if email failed but credits were deducted
                        if (creditsDeducted) {
                            console.log(`Refunding credits to ${logId} due to send failure`);
                            try {
                                await docClient.send(new UpdateCommand({
                                    TableName: process.env.USERS_TABLE,
                                    Key: { userId },
                                    UpdateExpression: 'SET credits = credits + :cost, updatedAt = :now',
                                    ExpressionAttributeValues: {
                                        ':cost': emailCost,
                                        ':now': new Date().toISOString()
                                    }
                                }));
                            } catch (refundErr) {
                                console.error(`CRITICAL: Failed to refund credits to ${logId}`, refundErr);
                            }
                        }
                    }
                }
            }
        } else {
            console.log('No users subscribed to daily email.');
        }

        // 4. Send Push Notifications
        const pushTable = process.env.PUSH_SUBSCRIPTIONS_TABLE;

        // Fetch VAPID Private Key using shared utility
        const vapidPrivateKey = await getSecret('PARAM_VAPID_PRIVATE_KEY');

        if (pushTable && process.env.VAPID_PUBLIC_KEY && vapidPrivateKey) {
            console.log('Starting Push Notifications...');

            const pushSubsResult = await docClient.send(new ScanCommand({
                TableName: pushTable,
                FilterExpression: 'active = :active',
                ExpressionAttributeValues: { ':active': true }
            }));

            const pushSubs = pushSubsResult.Items ?? [];

            if (pushSubs.length > 0) {
                console.log(`Sending Push to ${pushSubs.length} devices`);

                webpush.setVapidDetails(
                    process.env.VAPID_SUBJECT || 'mailto:example@example.com',
                    process.env.VAPID_PUBLIC_KEY,
                    vapidPrivateKey
                );

                const payload = JSON.stringify({
                    notification: {
                        title: `Thirukkural #${kuralData.kuralId}`,
                        body: `${kuralData.line1}\n${kuralData.line2}`,
                        icon: 'assets/icons/icon-192x192.png',
                        badge: 'assets/icons/icon-72x72.png',
                        data: {
                            url: `/kural/${kuralData.kuralId}`,
                            kuralId: kuralData.kuralId,
                            onActionClick: {
                                default: {
                                    operation: 'navigateLastFocusedOrOpen',
                                    url: `/kural/${kuralData.kuralId}`
                                }
                            }
                        }
                    }
                });

                for (const sub of pushSubs) {
                    try {
                        await webpush.sendNotification(sub.subscription, payload);
                        console.log(`Sent push to device ${sub.deviceId}`);

                        // Update lastActivity and extend TTL on successful delivery (15 days)
                        const newTTL = Math.floor(Date.now() / 1000) + (15 * 24 * 60 * 60);
                        await docClient.send(new UpdateCommand({
                            TableName: pushTable,
                            Key: { deviceId: sub.deviceId },
                            UpdateExpression: 'SET lastActivity = :now, lastActivityType = :type, #ttl = :ttl',
                            ExpressionAttributeNames: {
                                '#ttl': 'ttl',
                            },
                            ExpressionAttributeValues: {
                                ':now': new Date().toISOString(),
                                ':type': 'push_delivered',
                                ':ttl': newTTL,
                            },
                        }));
                    } catch (error: any) {
                        console.error(`Failed push for device ${sub.deviceId}`, error);
                        if (error.statusCode === 410 || error.statusCode === 404) {
                            console.log(`Deleting expired subscription for device ${sub.deviceId}`);
                            await docClient.send(new DeleteCommand({
                                TableName: pushTable,
                                Key: { deviceId: sub.deviceId }
                            }));
                        }
                    }
                }
            } else {
                console.log('No active push subscriptions found.');
            }
        } else {
            console.log('Push notification configuration missing (Table or Keys). Skipping.');
        }

        console.log('Daily job completed');

    } catch (err) {
        console.error('Error in daily job:', err);
        throw err;
    }
};
