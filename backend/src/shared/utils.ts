import { APIGatewayProxyResult } from 'aws-lambda';

export const ALLOWED_ORIGINS = [
    'https://thirukkural.site',
    'https://www.thirukkural.site',
    'https://dev.thirukkural.site',
    'http://localhost:4200',
];

export const createResponse = (statusCode: number, body: any, origin?: string): APIGatewayProxyResult => {
    const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        statusCode,
        headers: {
            'Access-Control-Allow-Origin': allowedOrigin,
            'Access-Control-Allow-Credentials': true,
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE',
        },
        body: JSON.stringify(body),
    };
};

/**
 * Safely parses a JSON string or returns the value if it's already an object/array.
 * Returns the original value or undefined if parsing fails.
 */
export const safeJsonParse = (value: any): any => {
    if (typeof value !== 'string') {
        return value;
    }
    try {
        return JSON.parse(value);
    } catch {
        return value; // Return as is if parsing fails (e.g., normal string)
    }
};
