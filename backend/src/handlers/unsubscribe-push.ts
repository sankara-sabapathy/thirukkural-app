import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.PUSH_SUBSCRIPTIONS_TABLE || '';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'DELETE,OPTIONS'
    };

    if (!TABLE_NAME) {
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Table name not configured' })
        };
    }

    try {
        // Get deviceId from path parameter
        const deviceId = event.pathParameters?.deviceId;

        if (!deviceId) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ message: 'Missing deviceId parameter' })
            };
        }

        // Delete the subscription from DynamoDB
        await docClient.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
                deviceId
            }
        }));

        console.log(`Unsubscribed device: ${deviceId}`);

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Unsubscribed successfully' })
        };
    } catch (error) {
        console.error('Error unsubscribing:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Internal server error' })
        };
    }
};
