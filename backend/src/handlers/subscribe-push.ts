import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo';

const TABLE_NAME = process.env.PUSH_SUBSCRIPTIONS_TABLE || '';
const RATE_LIMIT_TABLE = process.env.RATE_LIMIT_TABLE || '';

// Configuration
const ALLOWED_ORIGINS = [
    'https://thirukkural.krss.online',
    'http://localhost:4200',
];
const TTL_DAYS = 15;
const RATE_LIMIT_MAX = 5;      // Max requests per window
const RATE_LIMIT_WINDOW = 60;  // Window in seconds (1 minute)

// Interfaces for type safety
interface PushSubscriptionKeys {
    p256dh: string;
    auth: string;
}

interface PushSubscription {
    endpoint: string;
    expirationTime?: number | null;
    keys: PushSubscriptionKeys;
}

interface SubscribeRequestBody {
    subscription: PushSubscription;
    deviceId: string;
}

// Helper: Create CORS-aware response
const createResponse = (statusCode: number, body: object, origin: string): APIGatewayProxyResult => {
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        statusCode,
        headers: {
            'Access-Control-Allow-Origin': allowedOrigin,
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
            'Access-Control-Allow-Methods': 'POST,OPTIONS',
            'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify(body),
    };
};

// Validation function
const validateSubscription = (body: any): body is SubscribeRequestBody => {
    if (!body || typeof body !== 'object') return false;
    if (!body.deviceId || typeof body.deviceId !== 'string' || body.deviceId.length < 10) return false;

    const sub = body.subscription;
    if (!sub || typeof sub !== 'object') return false;
    if (!sub.endpoint || typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://')) return false;
    if (!sub.keys || typeof sub.keys !== 'object') return false;
    if (!sub.keys.p256dh || typeof sub.keys.p256dh !== 'string' || sub.keys.p256dh.length < 20) return false;
    if (!sub.keys.auth || typeof sub.keys.auth !== 'string' || sub.keys.auth.length < 10) return false;

    return true;
};

// Rate limiting check
const checkRateLimit = async (ip: string): Promise<boolean> => {
    if (!RATE_LIMIT_TABLE) return true; // Skip if table not configured

    const now = Math.floor(Date.now() / 1000);
    const windowKey = `subscribe:${ip}:${Math.floor(now / RATE_LIMIT_WINDOW)}`;

    try {
        const result = await docClient.send(new GetCommand({
            TableName: RATE_LIMIT_TABLE,
            Key: { pk: windowKey },
        }));

        const count = result.Item?.count || 0;
        if (count >= RATE_LIMIT_MAX) {
            return false;
        }

        // Increment counter
        await docClient.send(new PutCommand({
            TableName: RATE_LIMIT_TABLE,
            Item: {
                pk: windowKey,
                count: count + 1,
                ttl: now + RATE_LIMIT_WINDOW + 60,
            },
        }));

        return true;
    } catch (error) {
        console.error('Rate limit check error:', error);
        return true; // Fail open if rate limiting errors
    }
};

// Calculate TTL (15 days from now in Unix epoch seconds)
const calculateTTL = (): number => {
    return Math.floor(Date.now() / 1000) + (TTL_DAYS * 24 * 60 * 60);
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const origin = event.headers.origin || event.headers.Origin || '';

    // Validate origin
    if (!ALLOWED_ORIGINS.includes(origin) && origin !== '') {
        console.warn(`Rejected request from unauthorized origin: ${origin}`);
        return createResponse(403, { message: 'Forbidden: Origin not allowed' }, origin);
    }

    if (!TABLE_NAME) {
        return createResponse(500, { message: 'Table name not configured' }, origin);
    }

    // Rate limiting
    const clientIp = event.requestContext.identity?.sourceIp || 'unknown';
    const withinLimit = await checkRateLimit(clientIp);
    if (!withinLimit) {
        return createResponse(429, { message: 'Too many requests. Please try again later.' }, origin);
    }

    try {
        const body = JSON.parse(event.body || '{}');

        // Schema validation
        if (!validateSubscription(body)) {
            return createResponse(400, {
                message: 'Invalid request. Required: subscription.endpoint (https URL), subscription.keys.p256dh, subscription.keys.auth, deviceId (min 10 chars)'
            }, origin);
        }

        const { subscription, deviceId } = body;
        const now = new Date().toISOString();
        const ttl = calculateTTL();

        // Check if subscription already exists (deduplication)
        const existing = await docClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { deviceId },
        }));

        if (existing.Item && existing.Item.endpoint === subscription.endpoint) {
            // Renewal: Update TTL and lastActivity
            await docClient.send(new UpdateCommand({
                TableName: TABLE_NAME,
                Key: { deviceId },
                UpdateExpression: 'SET lastActivity = :now, lastActivityType = :type, #ttl = :ttl, updatedAt = :now',
                ExpressionAttributeNames: {
                    '#ttl': 'ttl',
                },
                ExpressionAttributeValues: {
                    ':now': now,
                    ':type': 'resubscribe',
                    ':ttl': ttl,
                },
            }));
            return createResponse(200, { message: 'Subscription renewed', ttlDays: TTL_DAYS }, origin);
        }

        // New subscription
        await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                deviceId,
                endpoint: subscription.endpoint,
                subscription,
                createdAt: now,
                lastActivity: now,
                lastActivityType: 'subscribe',
                active: true,
                ttl,
            },
        }));

        return createResponse(200, { message: 'Subscribed successfully', ttlDays: TTL_DAYS }, origin);
    } catch (error) {
        console.error('Error subscribing:', error);
        return createResponse(500, { message: 'Internal server error' }, origin);
    }
};
