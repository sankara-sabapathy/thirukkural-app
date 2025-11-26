import { APIGatewayProxyResult } from 'aws-lambda';

export const createResponse = (statusCode: number, body: any): APIGatewayProxyResult => {
    return {
        statusCode,
        headers: {
            'Access-Control-Allow-Origin': '*', // In production, restrict this to the frontend domain
            'Access-Control-Allow-Credentials': true,
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'OPTIONS,POST',
        },
        body: JSON.stringify(body),
    };
};
