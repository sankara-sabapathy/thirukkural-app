import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import * as crypto from 'crypto';
import { docClient } from '../shared/dynamo';
import { createResponse } from '../shared/utils';
import { sendEmail } from '../shared/email-service';
import { generateSystemEmail } from '../shared/email-templates';

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
                Key: { userId }, // Looking up by Cognito sub first
                ConsistentRead: true, // Ensure we see latest payment updates immediately
            };

            const result = await docClient.send(new GetCommand(params));
            const profileItem = result.Item;

            if (profileItem) {
                if (profileItem.type === 'AUTH_LINK') {
                    // It's an auth link, fetch the real mapped profile
                    const realProfileId = profileItem.linkedUserId;
                    const realResult = await docClient.send(new GetCommand({
                        TableName: TABLE_NAME,
                        Key: { userId: realProfileId },
                        ConsistentRead: true
                    }));
                    if (!realResult.Item) {
                        console.error(`Orphaned AUTH_LINK for ${userId} pointing to ${realProfileId}`);
                        return createResponse(500, { message: 'Profile data corrupted' }, origin);
                    }
                    return createResponse(200, realResult.Item, origin);
                } else if (!profileItem.type || profileItem.type !== 'PROFILE') {
                    // It's a legacy profile using the old 'sub' as PK!
                    // Zero-Downtime Lazy Migration
                    const newInternalId = crypto.randomUUID();
                    const migratedProfile = {
                        ...profileItem,
                        userId: newInternalId,
                        type: 'PROFILE',
                        migratedAt: new Date().toISOString()
                    };

                    // Insert the new profile
                    await docClient.send(new PutCommand({
                        TableName: TABLE_NAME,
                        Item: migratedProfile,
                        ConditionExpression: 'attribute_not_exists(userId)'
                    }));

                    // Overwrite the old record to become an AUTH_LINK
                    const authLink = {
                        userId: userId, // the old sub
                        type: 'AUTH_LINK',
                        linkedUserId: newInternalId,
                        createdAt: new Date().toISOString()
                    };

                    await docClient.send(new PutCommand({
                        TableName: TABLE_NAME,
                        Item: authLink
                    }));

                    console.log(`Lazy migrated legacy user ${userId} to new ID ${newInternalId}`);
                    return createResponse(200, migratedProfile, origin);
                } else {
                    // It is already a migrated native PROFILE, possibly accessed directly or mapped manually.
                    return createResponse(200, profileItem, origin);
                }
            } else {
                console.log('User not found by sub, checking EmailIndex for identity merging...');

                let actualUserIdToUse = crypto.randomUUID();
                let isNewUser = true;

                if (email) {
                    const emailResult = await docClient.send(new QueryCommand({
                        TableName: TABLE_NAME,
                        IndexName: 'EmailIndex',
                        KeyConditionExpression: 'email = :email',
                        ExpressionAttributeValues: { ':email': email }
                    }));

                    if (emailResult.Items && emailResult.Items.length > 0) {
                        // Found an existing user by email! Let's pick the first valid profile.
                        const foundItem = emailResult.Items.find(item => item.type === 'PROFILE' || !item.type);

                        if (foundItem) {
                            console.log(`Matching email found for ${email}, merging identity...`);
                            isNewUser = false;
                            actualUserIdToUse = foundItem.userId; // Will be internal ID or legacy sub

                            // Create the AUTH_LINK for the new sub pointing to the existing profile
                            await docClient.send(new PutCommand({
                                TableName: TABLE_NAME,
                                Item: {
                                    userId: userId, // The new sub
                                    type: 'AUTH_LINK',
                                    linkedUserId: actualUserIdToUse,
                                    createdAt: new Date().toISOString()
                                }
                            }));

                            // Fetch and return the target profile
                            const finalProfileResult = await docClient.send(new GetCommand({
                                TableName: TABLE_NAME,
                                Key: { userId: actualUserIdToUse },
                                ConsistentRead: true
                            }));
                            return createResponse(200, finalProfileResult.Item, origin);
                        }
                    }
                }

                if (isNewUser) {
                    console.log('No existing user found, creating brand new profile and auth link...');

                    const cfCountry = (event.headers?.['CloudFront-Viewer-Country'] || event.headers?.['cloudfront-viewer-country']) as string;
                    const region = (cfCountry && cfCountry.toUpperCase() === 'IN') ? 'IN' : (cfCountry ? 'ROW' : 'IN');
                    const currency = region === 'IN' ? 'INR' : 'USD';

                    const newProfile = {
                        userId: actualUserIdToUse,
                        email,
                        type: 'PROFILE',
                        isPaid: false,
                        receiveDailyEmail: false,
                        credits: 10,
                        subscriptionStatus: 'inactive',
                        region,
                        currency,
                        createdAt: new Date().toISOString(),
                    };

                    try {
                        // 1. Create Base Profile
                        await docClient.send(new PutCommand({
                            TableName: TABLE_NAME,
                            Item: newProfile,
                            ConditionExpression: 'attribute_not_exists(userId)'
                        }));

                        // 2. Create Auth Link mapping sub to Base Profile
                        await docClient.send(new PutCommand({
                            TableName: TABLE_NAME,
                            Item: {
                                userId: userId, // Cognito Sub
                                type: 'AUTH_LINK',
                                linkedUserId: actualUserIdToUse,
                                createdAt: new Date().toISOString()
                            }
                        }));

                        console.log('Default profile and Auth Link created');

                        if (email) {
                            try {
                                const systemEmail = generateSystemEmail({ type: 'WELCOME_NEW_USER' });
                                await sendEmail({
                                    to: [email],
                                    subject: systemEmail.subject,
                                    text: systemEmail.text,
                                    html: systemEmail.html
                                });
                                console.log(`[Welcome Email] Successfully dispatched for ${actualUserIdToUse}`);
                            } catch (emailErr) {
                                console.error(`[Welcome Email] SES Delivery failed for ${actualUserIdToUse}:`, emailErr);
                            }
                        }

                        return createResponse(200, newProfile, origin);
                    } catch (putErr: any) {
                        if (putErr.name === 'ConditionalCheckFailedException') {
                            console.log('Profile created concurrently, fetching existing...');
                            const retryResult = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { userId: actualUserIdToUse } }));
                            return createResponse(200, retryResult.Item, origin);
                        }
                        throw putErr;
                    }
                }
            }
        }

        if (method === 'PUT') {
            let body;
            try {
                body = JSON.parse(event.body ?? '{}');
            } catch (e) {
                return createResponse(400, { message: 'Invalid JSON body' }, origin);
            }

            // Resolve real internal ID from AUTH_LINK
            let internalUserId = userId;
            const linkCheckRes = await docClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { userId }
            }));
            if (linkCheckRes.Item && linkCheckRes.Item.type === 'AUTH_LINK') {
                internalUserId = linkCheckRes.Item.linkedUserId;
            } else if (!linkCheckRes.Item) {
                return createResponse(404, { message: 'User profile not found' }, origin);
            }

            // Validate allowed fields
            const { receiveDailyEmail } = body;

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
                Key: { userId: internalUserId },
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
