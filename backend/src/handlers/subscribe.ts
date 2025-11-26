import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo';
import { createResponse } from '../shared/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const body = JSON.parse(event.body ?? '{}');
        const email = body.email?.trim().toLowerCase();

        if (!email) {
            return createResponse(400, { message: 'Email required' });
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return createResponse(400, { message: 'Invalid email format' });
        }

        await docClient.send(new PutCommand({
            TableName: process.env.SUBSCRIBER_TABLE,
            Item: {
                email,
                subscribed: true,
                createdAt: new Date().toISOString(),
            },
        }));

        console.log(`Subscribed: ${email}`);
        return createResponse(200, { message: 'Subscribed successfully' });
    } catch (err) {
        console.error('Subscribe error:', err);
        return createResponse(500, { message: 'Internal server error' });
    }
};
