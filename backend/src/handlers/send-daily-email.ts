import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { docClient } from '../shared/dynamo';

const ses = new SESClient({});

export const handler = async (): Promise<void> => {
    try {
        // 1. Get all users who want daily emails
        // Note: For large datasets, Scan is inefficient. Consider using a GSI on 'receiveDailyEmail' or 'subscriptionStatus'.
        // For this scale, Scan is acceptable.
        const usersResult = await docClient.send(new ScanCommand({
            TableName: process.env.USERS_TABLE,
            FilterExpression: 'receiveDailyEmail = :rde',
            ExpressionAttributeValues: { ':rde': true }
        }));

        const users = usersResult.Items ?? [];

        if (users.length === 0) {
            console.log('No users subscribed to daily email.');
            return;
        }

        // 2. Pick a random Kural
        // Optimization: Instead of scanning all Kurals, we could pick a random ID if we know the max ID (1330).
        // But scanning is fine for 1330 items.
        const kuralResult = await docClient.send(new ScanCommand({ TableName: process.env.KURAL_TABLE }));
        const kurals = kuralResult.Items ?? [];

        if (kurals.length === 0) {
            console.error('No Kurals found in database');
            return;
        }

        const randomKural = kurals[Math.floor(Math.random() * kurals.length)];

        // Construct rich email content
        const kuralNumber = randomKural.kuralId;
        const kuralLine1 = randomKural.line1;
        const kuralLine2 = randomKural.line2;
        const translation = randomKural.translation || '';
        const explanation = randomKural.explanation || randomKural.mv || randomKural.sp || '';
        const couplet = randomKural.couplet || '';

        console.log(`Sending Kural ${kuralNumber} to ${users.length} users`);

        // 3. Send email to each user
        const promises = users.map(async (user) => {
            const email = user.email;
            if (!email) return;

            const sendCmd = new SendEmailCommand({
                Destination: { ToAddresses: [email] },
                Message: {
                    Body: {
                        Text: { Data: `${kuralLine1}\n${kuralLine2}\n\nTranslation: ${translation}\n\nExplanation: ${explanation}` },
                        Html: {
                            Data: `
                            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
                                <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #eee;">
                                    <h2 style="color: #333; margin: 0;">Thirukkural Daily</h2>
                                    <span style="color: #888; font-size: 14px;">Kural #${kuralNumber}</span>
                                </div>
                                
                                <div style="padding: 30px 0; text-align: center;">
                                    <p style="font-size: 20px; font-weight: bold; line-height: 1.6; color: #2c3e50; margin-bottom: 10px;">
                                        ${kuralLine1}<br>${kuralLine2}
                                    </p>
                                </div>

                                <div style="background-color: #f9f9f9; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
                                    <h3 style="font-size: 16px; color: #555; margin-top: 0;">Translation</h3>
                                    <p style="font-size: 16px; color: #333; font-style: italic; line-height: 1.5;">"${translation}"</p>
                                    ${couplet ? `<p style="font-size: 14px; color: #666; margin-top: 10px;">${couplet}</p>` : ''}
                                </div>

                                <div style="margin-bottom: 20px;">
                                    <h3 style="font-size: 16px; color: #555;">Explanation</h3>
                                    <p style="font-size: 15px; color: #444; line-height: 1.6;">${explanation}</p>
                                </div>

                                <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
                                
                                <div style="text-align: center; font-size: 12px; color: #999;">
                                    <p>You are receiving this because you opted in for daily emails.</p>
                                    <p>Subscription Status: ${user.isPaid ? 'Premium' : 'Free'}</p>
                                </div>
                            </div>
                        ` }
                    },
                    Subject: { Data: `Thirukkural #${kuralNumber}: ${translation.substring(0, 50)}...` },
                },
                Source: process.env.SES_SENDER,
            });

            try {
                await ses.send(sendCmd);
                console.log(`Sent to ${email}`);
            } catch (e) {
                console.error(`Failed for ${email}`, e);
            }
        });

        await Promise.all(promises);
        console.log('Daily email job completed');

    } catch (err) {
        console.error('Error in daily email job:', err);
        throw err;
    }
};
