import { DynamoDBClient, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import * as fs from 'fs';
import * as path from 'path';

const ddb = new DynamoDBClient({});
const dataPath = path.resolve(__dirname, '../../sampleThirukkuralDataset.json');

async function main() {
    const raw = fs.readFileSync(dataPath, 'utf-8');
    const json = JSON.parse(raw);

    // The dataset has a root property "allKural" which is an array
    const kurals = json.allKural;

    if (!Array.isArray(kurals)) {
        throw new Error('Invalid dataset format: allKural is not an array');
    }

    // Map all fields
    const items = kurals.map((k: any) => ({
        PutRequest: {
            Item: {
                kuralId: { N: k.number.toString() },
                iyal: { S: k.iyal || '' },
                iyal_tr: { S: k.iyal_tr || '' },
                iyal_tl: { S: k.iyal_tl || '' },
                pal: { S: k.pal || '' },
                pal_tr: { S: k.pal_tr || '' },
                pal_tl: { S: k.pal_tl || '' },
                adikaram: { S: k.adikaram || '' },
                adikaram_tr: { S: k.adikaram_tr || '' },
                adikaram_tl: { S: k.adikaram_tl || '' },
                line1: { S: k.line1 || '' },
                line1_tl: { S: k.line1_tl || '' },
                line2: { S: k.line2 || '' },
                line2_tl: { S: k.line2_tl || '' },
                translation: { S: k.translation || '' },
                explanation: { S: k.explanation || '' },
                couplet: { S: k.couplet || '' },
                mv: { S: k.mv || '' },
                mk: { S: k.mk || '' },
                sp: { S: k.sp || '' },
                // Store complex objects as JSON strings if needed, or just skip if not critical
                // For now, let's store the main text fields. 
                // If we want to store arrays/objects, we can use DynamoDB Map/List types or JSON stringify.
                // Storing as JSON string for simplicity for complex nested fields
                couplet_obj: { S: JSON.stringify(k.couplet_obj) },
                explanation_obj: { S: JSON.stringify(k.explanation_obj) },
                mu_varatha: { S: JSON.stringify(k.mu_varatha) },
                parimela: { S: JSON.stringify(k.parimela) },
                salaman: { S: JSON.stringify(k.salaman) },
                manikudavar: { S: JSON.stringify(k.manikudavar) },
                v_munusami: { S: JSON.stringify(k.v_munusami) },
                mu_karu: { S: JSON.stringify(k.mu_karu) },
            },
        },
    }));

    const tableName = process.env.KURAL_TABLE;
    if (!tableName) throw new Error('KURAL_TABLE env var not set');

    console.log(`Starting seed for table ${tableName} with ${items.length} items...`);

    for (let i = 0; i < items.length; i += 25) {
        const batch = items.slice(i, i + 25);
        try {
            await ddb.send(new BatchWriteItemCommand({ RequestItems: { [tableName]: batch } }));
            console.log(`Wrote ${i + batch.length}/${items.length}`);
        } catch (error) {
            console.error(`Error writing batch ${i}:`, error);
        }
    }
    console.log('Seed complete.');
}

main().catch(console.error);
