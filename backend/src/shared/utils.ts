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
