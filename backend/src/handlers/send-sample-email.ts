import { APIGatewayProxyHandler } from 'aws-lambda';
import { ScanCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { docClient } from '../shared/dynamo';
import { createResponse } from '../shared/utils';
import { generateKuralEmail, Kural } from '../shared/email-templates';

const ses = new SESClient({});

const RATE_LIMIT_SECONDS = 24 * 60 * 60; // 24 hours

export const handler: APIGatewayProxyHandler = async (event) => {
    try {
        if (!event.body) {
            return createResponse(400, { message: 'Missing request body' });
        }

        const { email } = JSON.parse(event.body);

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return createResponse(400, { message: 'Invalid email address' });
        }

        // 1. Check Rate Limit
        const rateLimitTable = process.env.RATE_LIMIT_TABLE;
        if (!rateLimitTable) {
            throw new Error('RATE_LIMIT_TABLE environment variable not set');
        }

        const rateLimitKey = `email:${email}`;
        const now = Math.floor(Date.now() / 1000);

        // Check if user is rate limited
        // We can use a conditional put, but checking first allows for a specific error message
        // However, conditional put is atomic and better for race conditions.
        // Let's try to put with condition attribute_not_exists(pk)

        const ttl = now + RATE_LIMIT_SECONDS;

        try {
            await docClient.send(new PutCommand({
                TableName: rateLimitTable,
                Item: {
                    pk: rateLimitKey,
                    ttl: ttl
                },
                ConditionExpression: 'attribute_not_exists(pk)',
            }));
        } catch (err: any) {
            if (err.name === 'ConditionalCheckFailedException') {
                return createResponse(429, { message: 'You can only send one sample email every 24 hours.' });
            }
            throw err;
        }

        // 2. Pick a random Kural
        const kuralTable = process.env.KURAL_TABLE;
        const kuralResult = await docClient.send(new ScanCommand({ TableName: kuralTable }));
        const kurals = kuralResult.Items ?? [];

        if (kurals.length === 0) {
            console.error('No Kurals found in database');
            return createResponse(500, { message: 'Internal Server Error' });
        }

        const randomKural = kurals[Math.floor(Math.random() * kurals.length)];

        // 3. Send Sample Email
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

        const { subject, text, html } = generateKuralEmail(kuralData, true); // isSample = true

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

        await ses.send(sendCmd);

        return createResponse(200, { message: 'Sample email sent successfully!' });

    } catch (err) {
        console.error('Error sending sample email:', err);
        return createResponse(500, { message: 'Internal Server Error' });
    }
};
