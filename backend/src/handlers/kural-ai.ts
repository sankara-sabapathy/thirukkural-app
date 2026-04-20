import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createResponse } from '../shared/utils';
import { getOrGenerateAiExplanation } from '../shared/ai-utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const httpMethod = event.httpMethod;
        const kuralIdStr = event.pathParameters?.id;

        if (!kuralIdStr) {
            return createResponse(400, { error: 'Missing kural ID' });
        }

        const kuralId = parseInt(kuralIdStr, 10);
        if (isNaN(kuralId)) {
            return createResponse(400, { error: 'Invalid kural ID' });
        }

        if (httpMethod === 'GET') {
            // Check if already exists, do not generate
            const explanation = await getOrGenerateAiExplanation(kuralId, false);
            
            if (explanation) {
                return createResponse(200, explanation);
            } else {
                return createResponse(404, { error: 'AI Explanation not yet available' });
            }
        } else if (httpMethod === 'POST') {
            // Force generate (or return existing if another thread generated it first)
            const explanation = await getOrGenerateAiExplanation(kuralId, true);
            
            if (explanation) {
                return createResponse(200, explanation);
            } else {
                return createResponse(500, { error: 'Failed to generate AI Explanation' });
            }
        }

        return createResponse(405, { error: 'Method Not Allowed' });
    } catch (error) {
        console.error('Error in kural AI handler:', error);
        return createResponse(500, { error: 'Internal Server Error' });
    }
};
