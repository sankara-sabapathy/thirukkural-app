import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.PUSH_SUBSCRIPTIONS_TABLE || '';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    if (!TABLE_NAME) {
        return { statusCode: 500, body: JSON.stringify({ message: 'Table name not configured' }) };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { subscription, deviceId } = body;

        if (!subscription || !deviceId) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Missing subscription or deviceId' }) };
        }

        await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                deviceId,
                subscription,
                createdAt: new Date().toISOString(),
                active: true
            }
        }));

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'POST,OPTIONS'
            },
            body: JSON.stringify({ message: 'Subscribed successfully' })
        };
    } catch (error) {
        console.error('Error subscribing:', error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'Internal server error' })
        };
    }
};
