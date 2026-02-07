import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo';
import { createResponse } from '../shared/utils';

const TABLE_NAME = process.env.USERS_TABLE;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const origin = event.headers?.origin || event.headers?.Origin;
    try {
        // Get userId from Cognito Authorizer
        const userId = event.requestContext.authorizer?.claims?.sub;
        const email = event.requestContext.authorizer?.claims?.email;

        if (!userId) {
            return createResponse(401, { message: 'Unauthorized' }, origin);
        }

        const method = event.httpMethod;

        if (method === 'GET') {
            console.log('Fetching profile from', TABLE_NAME);
            const params = {
                TableName: TABLE_NAME,
                Key: { userId },
            };
            // console.log('DynamoDB Get Params:', JSON.stringify(params)); // Redacted PII

            const result = await docClient.send(new GetCommand(params));
            // console.log('DynamoDB Get Result:', result); // Redacted PII

            if (!result.Item) {
                console.log('User not found, creating default profile...');
                // If user doesn't exist in DB but is authenticated, create a default profile
                // Detect region from CloudFront headers (injected by CF)
                const cfCountry = (event.headers?.['CloudFront-Viewer-Country'] || event.headers?.['cloudfront-viewer-country']) as string;

                // Default to IN if not present (for now), but prefer detected country
                const region = (cfCountry && cfCountry.toUpperCase() === 'IN') ? 'IN' : (cfCountry ? 'ROW' : 'IN');
                const currency = region === 'IN' ? 'INR' : 'USD';

                // TODO: [TK-101] Improve region detection accuracy and support more currencies if needed.
                // Currently assuming IN = INR, Everything else = USD (ROW).

                const newProfile = {
                    userId,
                    email,
                    isPaid: false, // Default to free
                    receiveDailyEmail: false, // Default to false
                    credits: 0,
                    subscriptionStatus: 'inactive',
                    region,
                    currency,
                    createdAt: new Date().toISOString(),
                };

                try {
                    await docClient.send(new PutCommand({
                        TableName: TABLE_NAME,
                        Item: newProfile,
                        ConditionExpression: 'attribute_not_exists(userId)'
                    }));
                    console.log('Default profile created');
                    return createResponse(200, newProfile, origin);
                } catch (putErr: any) {
                    if (putErr.name === 'ConditionalCheckFailedException') {
                        console.log('Profile created concurrently, fetching existing...');
                        const retryResult = await docClient.send(new GetCommand(params));
                        return createResponse(200, retryResult.Item, origin);
                    }
                    throw putErr;
                }
            }

            return createResponse(200, result.Item, origin);
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
                return createResponse(400, { message: 'No valid fields to update' }, origin);
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

            return createResponse(200, result.Attributes, origin);
        }

        return createResponse(405, { message: 'Method not allowed' }, origin);

    } catch (err) {
        console.error('User profile error:', err);
        return createResponse(500, { message: 'Internal server error' }, origin);
    }
};
