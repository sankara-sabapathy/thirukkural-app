import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { docClient } from '../shared/dynamo';

const ses = new SESClient({});

export const handler = async (): Promise<void> => {
    try {
        // 1. Get all active subscribers
        const subsResult = await docClient.send(new ScanCommand({
            TableName: process.env.SUBSCRIBER_TABLE,
            FilterExpression: 'subscribed = :s',
            ExpressionAttributeValues: { ':s': true }
        }));

        const subscribers = subsResult.Items ?? [];

        if (subscribers.length === 0) {
            console.log('No subscribers – nothing to send.');
            return;
        }

        // 2. Pick a random Kural
        const kuralResult = await docClient.send(new ScanCommand({ TableName: process.env.KURAL_TABLE }));
        const kurals = kuralResult.Items ?? [];

        if (kurals.length === 0) {
            console.error('No Kurals found in database');
            return;
        }

        const randomKural = kurals[Math.floor(Math.random() * kurals.length)];
        const kuralText = `${randomKural.line1}\n${randomKural.line2}\n\nExplanation: ${randomKural.mv || randomKural.sp || ''}`;

        console.log(`Sending Kural ${randomKural.kuralId} to ${subscribers.length} subscribers`);

        // 3. Send email to each subscriber
        const promises = subscribers.map(async (sub) => {
            const email = sub.email;
            const sendCmd = new SendEmailCommand({
                Destination: { ToAddresses: [email] },
                Message: {
                    Body: {
                        Text: { Data: kuralText },
                        Html: {
                            Data: `
                            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                                <h2>Thirukkural #${randomKural.kuralId}</h2>
                                <p style="font-size: 18px; font-weight: bold;">${randomKural.line1}<br>${randomKural.line2}</p>
                                <hr>
                                <p>${randomKural.mv || randomKural.sp || ''}</p>
                                <p style="font-size: 12px; color: #888;">You are receiving this because you subscribed to Thirukkural Daily.</p>
                            </div>
                        ` }
                    },
                    Subject: { Data: `Daily Thirukkural #${randomKural.kuralId}` },
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
