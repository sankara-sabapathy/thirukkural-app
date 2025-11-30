import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from './dynamo';

/**
 * Gets a random Thirukkural from the database
 * @returns Random kural item or null if not found
 */
export async function getRandomKural() {
    const kuralTable = process.env.KURAL_TABLE;

    if (!kuralTable) {
        throw new Error('KURAL_TABLE environment variable not set');
    }

    // Generate random kural ID between 1 and 1080
    const randomKuralId = Math.floor(Math.random() * 1080) + 1;

    const result = await docClient.send(new GetCommand({
        TableName: kuralTable,
        Key: { kuralId: randomKuralId }
    }));

    return result.Item ?? null;
}
