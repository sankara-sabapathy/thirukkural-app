import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { createResponse } from '../shared/utils';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.PUSH_SUBSCRIPTIONS_TABLE || '';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const origin = event.headers?.origin || event.headers?.Origin;

    if (!TABLE_NAME) {
        return createResponse(500, { message: 'Table name not configured' }, origin);
    }

    try {
        // Get deviceId from path parameter
        const deviceId = event.pathParameters?.deviceId;

        if (!deviceId) {
            return createResponse(400, { message: 'Missing deviceId parameter' }, origin);
        }

        // Delete the subscription from DynamoDB
        await docClient.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
                deviceId
            }
        }));

        console.log(`Unsubscribed device: ${deviceId}`);

        return createResponse(200, { message: 'Unsubscribed successfully' }, origin);
    } catch (error) {
        console.error('Error unsubscribing:', error);
        return createResponse(500, { message: 'Internal server error' }, origin);
    }
};
