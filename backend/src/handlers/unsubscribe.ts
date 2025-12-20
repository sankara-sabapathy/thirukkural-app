import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
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

        // 1. Look up userId from email using GSI
        const userResult = await docClient.send(new QueryCommand({
            TableName: process.env.USERS_TABLE,
            IndexName: 'EmailIndex',
            KeyConditionExpression: 'email = :email',
            ExpressionAttributeValues: {
                ':email': email
            }
        }));

        if (!userResult.Items || userResult.Items.length === 0) {
            console.warn(`Unsubscribe requested for unknown email: ${email}`);
            // If user doesn't exist, they won't get emails anyway. Return success.
            return createResponse(200, { message: 'Unsubscribed successfully' });
        }

        const userId = userResult.Items[0].userId;

        // 2. Update user preference in USERS_TABLE using the correct userId
        await docClient.send(new UpdateCommand({
            TableName: process.env.USERS_TABLE,
            Key: { userId: userId },
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
