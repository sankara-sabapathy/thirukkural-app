import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo';
import { createResponse } from '../shared/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const body = JSON.parse(event.body ?? '{}');
        const email = body.email?.trim().toLowerCase();

        if (!email) {
            return createResponse(400, { message: 'Email required' });
        }

        await docClient.send(new DeleteCommand({
            TableName: process.env.SUBSCRIBER_TABLE,
            Key: { email },
        }));

        console.log(`Unsubscribed: ${email}`);
        return createResponse(200, { message: 'Unsubscribed successfully' });
    } catch (err) {
        console.error('Unsubscribe error:', err);
        return createResponse(500, { message: 'Internal server error' });
    }
};
