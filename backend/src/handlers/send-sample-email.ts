import { APIGatewayProxyHandler } from 'aws-lambda';
import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

import { docClient } from '../shared/dynamo';
import { createResponse, safeJsonParse } from '../shared/utils';
import { generateKuralEmail, Kural } from '../shared/email-templates';
import { getRandomKural } from '../shared/kural-utils';

import { sendEmail } from '../shared/email-service';
import { getOrGenerateAiExplanation } from '../shared/ai-utils';

const RATE_LIMIT_SECONDS = 24 * 60 * 60; // 24 hours

export const handler: APIGatewayProxyHandler = async (event) => {
    const origin = event.headers?.origin || event.headers?.Origin;
    try {
        if (!event.body) {
            return createResponse(400, { message: 'Missing request body' }, origin);
        }

        const { email } = JSON.parse(event.body);

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return createResponse(400, { message: 'Invalid email address' }, origin);
        }

        // 1. Check Rate Limit
        const rateLimitTable = process.env.RATE_LIMIT_TABLE;
        const stage = process.env.STAGE;

        if (!rateLimitTable) {
            throw new Error('RATE_LIMIT_TABLE environment variable not set');
        }

        const maxEmails = stage === 'prod' ? 1 : 5;
        const rateLimitKey = `email:${email}`;
        const now = Math.floor(Date.now() / 1000);
        const ttl = now + RATE_LIMIT_SECONDS;

        try {
            // A. Initial Window Creation / Reset (if missing or expired)
            try {
                await docClient.send(new PutCommand({
                    TableName: rateLimitTable,
                    Item: {
                        pk: rateLimitKey,
                        ttl: ttl,
                        count: 0
                    },
                    ConditionExpression: 'attribute_not_exists(pk) OR #ttl < :now',
                    ExpressionAttributeNames: { '#ttl': 'ttl' },
                    ExpressionAttributeValues: { ':now': now }
                }));
            } catch (err: any) {
                if (err.name !== 'ConditionalCheckFailedException') {
                    throw err;
                }
                // If condition failed, it means a valid window already exists. Proceed to increment.
            }

            // B. Atomic Increment & Check
            await docClient.send(new UpdateCommand({
                TableName: rateLimitTable,
                Key: { pk: rateLimitKey },
                UpdateExpression: 'SET #count = #count + :one',
                ConditionExpression: '#count < :max',
                ExpressionAttributeNames: { '#count': 'count' },
                ExpressionAttributeValues: {
                    ':one': 1,
                    ':max': maxEmails
                }
            }));

        } catch (err: any) {
            console.error('Rate limit check error:', err);
            if (err.name === 'ConditionalCheckFailedException') {
                return createResponse(429, { message: `You can only send ${maxEmails} sample emails every 24 hours.` }, origin);
            }
            throw err;
        }

        // 2. Pick a random Kural
        const randomKural = await getRandomKural();

        if (!randomKural) {
            console.error('Failed to fetch random Kural from database');
            return createResponse(500, { message: 'Internal Server Error' }, origin);
        }

        // 3. Send Sample Email
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

        // Fetch or trigger AI explanation generation
        let ai_explanation_en = randomKural.ai_explanation_en;
        let ai_explanation_ta = randomKural.ai_explanation_ta;
        
        if (!ai_explanation_en || !ai_explanation_ta) {
            console.log(`AI Explanation missing for Kural ${kuralData.kuralId}. Attempting to generate...`);
            const generated = await getOrGenerateAiExplanation(kuralData.kuralId, true);
            if (generated) {
                ai_explanation_en = generated.english;
                ai_explanation_ta = generated.tamil;
            }
        }

        kuralData.ai_explanation_en = ai_explanation_en;
        kuralData.ai_explanation_ta = ai_explanation_ta;

        const { subject, text, html } = generateKuralEmail(kuralData, true); // isSample = true

        await sendEmail({
            to: [email],
            subject: subject,
            text: text,
            html: html
        });

        return createResponse(200, { message: 'Sample email sent successfully!' }, origin);

    } catch (err) {
        console.error('Error sending sample email:', err);
        return createResponse(500, { message: 'Internal Server Error' }, origin);
    }
};
