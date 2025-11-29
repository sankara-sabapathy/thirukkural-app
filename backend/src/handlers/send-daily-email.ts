import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { docClient } from '../shared/dynamo';
import { generateKuralEmail, Kural } from '../shared/email-templates';

const ses = new SESClient({});

export const handler = async (): Promise<void> => {
    try {
        // 1. Get all users who want daily emails
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
        const kuralResult = await docClient.send(new ScanCommand({ TableName: process.env.KURAL_TABLE }));
        const kurals = kuralResult.Items ?? [];

        if (kurals.length === 0) {
            console.error('No Kurals found in database');
            return;
        }

        const randomKural = kurals[Math.floor(Math.random() * kurals.length)];

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

        console.log(`Sending Kural ${kuralData.kuralId} to ${users.length} users`);

        // 3. Send email to each user with delay
        for (const user of users) {
            const email = user.email;
            if (!email) continue;

            const sendCmd = new SendEmailCommand({
                Destination: { ToAddresses: [email] },
                Message: {
                    Body: {
                        Text: { Data: text },
                        Html: { Data: html }
                    },
                    Subject: { Data: subject },
                },
                Source: 'Thirukkural Daily <thirukkural-daily@krss.online>',
                ReplyToAddresses: ['sabapathy.work@gmail.com'],
            });

            try {
                await ses.send(sendCmd);
                console.log(`Sent to ${email}`);
                // Wait 1 second to respect SES sandbox limits
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (e) {
                console.error(`Failed for ${email}`, e);
            }
        }

        console.log('Daily email job completed');

    } catch (err) {
        console.error('Error in daily email job:', err);
        throw err;
    }
};
