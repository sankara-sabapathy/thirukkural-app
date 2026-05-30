import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from './dynamo';
import { getSecret } from './secrets';
import { GoogleGenAI } from '@google/genai';

export interface AiExplanation {
    english: string;
    tamil: string;
}

function stripMarkdownFence(text: string): string {
    return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

function extractFirstJsonObject(text: string): string | null {
    const start = text.indexOf('{');
    if (start === -1) {
        return null;
    }

    let depth = 0;
    let inString = false;
    let escaping = false;

    for (let i = start; i < text.length; i++) {
        const char = text[i];

        if (escaping) {
            escaping = false;
            continue;
        }

        if (char === '\\') {
            escaping = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            continue;
        }

        if (inString) {
            continue;
        }

        if (char === '{') {
            depth++;
        } else if (char === '}') {
            depth--;

            if (depth === 0) {
                return text.slice(start, i + 1);
            }
        }
    }

    return null;
}

export function parseAiExplanationResponse(responseText: string): AiExplanation {
    const cleanedText = stripMarkdownFence(responseText);
    const jsonText = extractFirstJsonObject(cleanedText);

    if (!jsonText) {
        throw new Error('No JSON object found in Gemini response');
    }

    const parsed = JSON.parse(jsonText) as Partial<AiExplanation>;

    if (typeof parsed.english !== 'string' || typeof parsed.tamil !== 'string') {
        throw new Error('Gemini response is missing required english/tamil fields');
    }

    return {
        english: parsed.english.trim(),
        tamil: parsed.tamil.trim(),
    };
}

/**
 * Helper to fetch Kural to understand the original text if we need to explain it.
 */
async function fetchKural(kuralId: number) {
    const kuralResult = await docClient.send(new GetCommand({
        TableName: process.env.KURAL_TABLE,
        Key: { kuralId }
    }));
    return kuralResult.Item;
}

export async function getOrGenerateAiExplanation(kuralId: number, forceGenerate: boolean = false): Promise<AiExplanation | null> {
    try {
        const kural = await fetchKural(kuralId);
        
        if (!kural) {
            console.error(`Kural ${kuralId} not found in DB.`);
            return null;
        }

        // 1. Check if already cached
        if (kural.ai_explanation_en && kural.ai_explanation_ta) {
            return {
                english: kural.ai_explanation_en,
                tamil: kural.ai_explanation_ta
            };
        }

        // 2. Return null if we are just checking (e.g. from a GET request)
        if (!forceGenerate) {
            return null;
        }

        console.log(`Generating new AI Explanation for Kural ${kuralId}`);

        // 3. Fetch Gemini API Key
        const apiKey = await getSecret('PARAM_GOOGLE_GEMINI_API_KEY');
        if (!apiKey) {
            console.warn('Gemini API key is not configured.');
            return null;
        }

        const ai = new GoogleGenAI({ apiKey });

        const prompt = `
You are an expert on Thirukkural, the ancient Tamil philosophical text.

I have Thirukkural #${kuralId}:
Tamil Couplet:
${kural.line1}
${kural.line2}

English Translation Reference:
${kural.translation}

Provide a very simple, easily understandable explanation of this Kural.
The goal is to help modern readers understand its practical wisdom in daily life. 
Do not use overly complex or archaic language.

You MUST provide your output as a raw JSON string without markdown or code blocks, containing exactly these keys:
{
  "english": "Simple explanation in English",
  "tamil": "Simple explanation in Tamil"
}
`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                temperature: 0.7
            }
        });

        const responseText = response.text;
        if (!responseText) {
            console.error('Empty response from Gemini API');
            return null;
        }

        const generated = parseAiExplanationResponse(responseText);

        // 4. Save to DynamoDB permanently
        await docClient.send(new UpdateCommand({
            TableName: process.env.KURAL_TABLE,
            Key: { kuralId },
            UpdateExpression: 'SET ai_explanation_en = :en, ai_explanation_ta = :ta',
            ExpressionAttributeValues: {
                ':en': generated.english,
                ':ta': generated.tamil
            }
        }));

        console.log(`Successfully generated and cached AI Explanation for Kural ${kuralId}`);

        return generated;

    } catch (error) {
        console.error(`Error in getOrGenerateAiExplanation for ${kuralId}:`, error);
        return null;
    }
}
