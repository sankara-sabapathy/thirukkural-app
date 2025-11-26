import { DynamoDBClient, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import * as fs from 'fs';
import * as path from 'path';

interface Kural {
    number: number;
    iyal: string;
    iyal_tr: string;
    iyal_tl: string;
    pal: string;
    pal_tr: string;
    pal_tl: string;
    adikaram: string;
    adikaram_tr: string;
    adikaram_tl: string;
    line1: string;
    line1_tl: string;
    line2: string;
    line2_tl: string;
    kural: string[];
}

const ddb = new DynamoDBClient({});
const dataPath = path.resolve(__dirname, '../../data/allKural.json');

async function main() {
    const raw = fs.readFileSync(dataPath, 'utf-8');
    const json = JSON.parse(raw);
    const items = (json.allKural as Kural[]).map(k => ({
        PutRequest: {
            Item: {
                kuralId: { N: k.number.toString() },
                iyal: { S: k.iyal },
                pal: { S: k.pal },
                adikaram: { S: k.adikaram },
                line1: { S: k.line1 },
                line2: { S: k.line2 },
                fullKural: { S: JSON.stringify(k.kural) },
            },
        },
    }));

    const tableName = process.env.KURAL_TABLE;
    if (!tableName) throw new Error('KURAL_TABLE env var not set');

    for (let i = 0; i < items.length; i += 25) {
        const batch = items.slice(i, i + 25);
        await ddb.send(new BatchWriteItemCommand({ RequestItems: { [tableName]: batch } }));
        console.log(`Wrote ${i + batch.length}/${items.length}`);
    }
}

main().catch(console.error);
