import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo';
import { createResponse } from '../shared/utils';

const TABLE_NAME = process.env.USERS_TABLE;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        // Get userId from Cognito Authorizer
        const userId = event.requestContext.authorizer?.claims?.sub;
        const email = event.requestContext.authorizer?.claims?.email;

        if (!userId) {
            return createResponse(401, { message: 'Unauthorized' });
        }

        const method = event.httpMethod;

        if (method === 'GET') {
            const result = await docClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { userId },
            }));

            if (!result.Item) {
                // If user doesn't exist in DB but is authenticated, create a default profile
                const newProfile = {
                    userId,
                    email,
                    isPaid: false, // Default to free
                    receiveDailyEmail: true, // Default to true
                    createdAt: new Date().toISOString(),
                };
                await docClient.send(new PutCommand({
                    TableName: TABLE_NAME,
                    Item: newProfile,
                }));
                return createResponse(200, newProfile);
            }

            return createResponse(200, result.Item);
        }

        if (method === 'PUT') {
            const body = JSON.parse(event.body ?? '{}');

            // Validate allowed fields
            const { receiveDailyEmail } = body;

            // We don't allow updating 'isPaid' from client side directly for security. 
            // That should be handled by a payment webhook or admin process.
            // But for this exercise, we'll assume only preferences are updatable here.

            const updateExp = [];
            const expAttrNames: Record<string, string> = {};
            const expAttrValues: Record<string, any> = {};

            if (typeof receiveDailyEmail === 'boolean') {
                updateExp.push('#rde = :rde');
                expAttrNames['#rde'] = 'receiveDailyEmail';
                expAttrValues[':rde'] = receiveDailyEmail;
            }

            if (updateExp.length === 0) {
                return createResponse(400, { message: 'No valid fields to update' });
            }

            expAttrNames['#updatedAt'] = 'updatedAt';
            expAttrValues[':updatedAt'] = new Date().toISOString();
            updateExp.push('#updatedAt = :updatedAt');

            // Ensure email is also stored if it wasn't before (syncing with Cognito)
            if (email) {
                updateExp.push('#email = :email');
                expAttrNames['#email'] = 'email';
                expAttrValues[':email'] = email;
            }

            const result = await docClient.send(new UpdateCommand({
                TableName: TABLE_NAME,
                Key: { userId },
                UpdateExpression: `SET ${updateExp.join(', ')}`,
                ExpressionAttributeNames: expAttrNames,
                ExpressionAttributeValues: expAttrValues,
                ReturnValues: 'ALL_NEW',
            }));

            return createResponse(200, result.Attributes);
        }

        return createResponse(405, { message: 'Method not allowed' });

    } catch (err) {
        console.error('User profile error:', err);
        return createResponse(500, { message: 'Internal server error' });
    }
};
