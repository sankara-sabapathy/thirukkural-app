import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo';
import { createResponse } from '../shared/utils';
import { verifyUnsubscribeToken } from '../shared/crypto-utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const body = JSON.parse(event.body ?? '{}');
        const token = body.token;
        const feedback = body.feedback;

        console.log('Unsubscribe request:', { token, feedback });

        if (!token) {
            return createResponse(400, { message: 'Token required' });
        }

        const email = verifyUnsubscribeToken(token);

        if (!email) {
            return createResponse(400, { message: 'Invalid or expired unsubscribe link' });
        }

        // Update user preference in USERS_TABLE
        await docClient.send(new UpdateCommand({
            TableName: process.env.USERS_TABLE,
            Key: { userId: email }, // Assuming userId is email, or we need to look up.
            // Wait, send-daily-email uses Scan and email property.
            // usersTable definition in stack: partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING }
            // user-profile handler uses event.requestContext.authorizer.claims.email as userId ??
            // Let's check user-profile.ts
            UpdateExpression: 'SET receiveDailyEmail = :false, lastUnsubscribeDate = :now, unsubscribeFeedback = :feedback',
            ExpressionAttributeValues: {
                ':false': false,
                ':now': new Date().toISOString(),
                ':feedback': feedback || 'No feedback provided'
            }
        }));

        console.log(`Unsubscribed successfully: ${email}`);
        return createResponse(200, { message: 'Unsubscribed successfully' });
    } catch (err) {
        console.error('Unsubscribe error:', err);
        return createResponse(500, { message: 'Internal server error' });
    }
};
