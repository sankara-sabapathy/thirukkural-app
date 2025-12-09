import { ScanCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo';
import { generateKuralEmail, Kural } from '../shared/email-templates';
import { getRandomKural } from '../shared/kural-utils';
import { sendEmail } from '../shared/email-service';
import * as webpush from 'web-push';



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
            transliteration: randomKural.transliteration,
            mk: randomKural.mk,
            mv: randomKural.mv,
            sp: randomKural.sp
        };

        const { subject, text, html } = generateKuralEmail(kuralData);

        // 3. Send email to each user with delay
        if (users.length > 0) {
            console.log(`Sending Kural ${kuralData.kuralId} to ${users.length} users via Email`);
            for (const user of users) {
                const email = user.email;
                if (!email) continue;

                try {
                    await sendEmail({
                        to: [email],
                        subject: subject,
                        text: text,
                        html: html
                    });
                    console.log(`Sent email to ${email}`);
                    // Wait 1 second to respect limits (SES sandbox or API rate limits)
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (e) {
                    console.error(`Failed email for ${email}`, e);
                }
            }
        } else {
            console.log('No users subscribed to daily email.');
        }

        // 4. Send Push Notifications
        const pushTable = process.env.PUSH_SUBSCRIPTIONS_TABLE;
        if (pushTable && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
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
                    process.env.VAPID_PRIVATE_KEY
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
