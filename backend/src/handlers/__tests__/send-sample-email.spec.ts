import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from '../send-sample-email';

const ddbMock = mockClient(DynamoDBDocumentClient);

vi.mock('../../shared/kural-utils', () => ({
    getRandomKural: vi.fn(),
}));
vi.mock('../../shared/email-service', () => ({
    sendEmail: vi.fn(),
}));

import { getRandomKural } from '../../shared/kural-utils';
import { sendEmail } from '../../shared/email-service';

describe('Send Sample Email Handler', () => {
    const originalEnv = process.env;
    const mockKural = {
        kuralId: 1,
        line1: 'l1',
        line2: 'l2',
        line1_tl: 'l1 transliteration',
        line2_tl: 'l2 transliteration',
        translation: 'Test Translation',
        mk: 'mk', mv: 'mv', sp: 'sp',
        parimela: JSON.stringify(['Title', 'Pari Content']),
        manikudavar: JSON.stringify(['Title', 'Mana Content']),
        v_munusami: JSON.stringify(['Title', 'Munu Content'])
    };

    const conditionalCheckFailed = new Error('ConditionalCheckFailedException');
    conditionalCheckFailed.name = 'ConditionalCheckFailedException';

    beforeEach(() => {
        ddbMock.reset();
        vi.resetAllMocks();

        process.env = {
            ...originalEnv,
            RATE_LIMIT_TABLE: 'RateTable',
            STAGE: 'dev'
        };

        (getRandomKural as any).mockResolvedValue(mockKural);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    const createEvent = (email: string) => ({
        body: JSON.stringify({ email }),
        headers: { origin: 'http://localhost' }
    } as any);

    it('should allow first request and create record (dev)', async () => {
        process.env.STAGE = 'dev';
        // Simulate Put success (new record created)
        ddbMock.on(PutCommand).resolves({});
        // Simulate Update success (increment)
        ddbMock.on(UpdateCommand).resolves({});

        const result = await handler(createEvent('test@test.com'), {} as any, () => null);

        expect(result?.statusCode).toBe(200);

        // Verify Put called with count 0
        const putCalls = ddbMock.calls().filter(c => c.args[0] instanceof PutCommand);
        expect(putCalls).toHaveLength(1);
        const putItem = (putCalls[0].args[0].input as any).Item;
        expect(putItem.count).toBe(0);
        expect((putCalls[0].args[0].input as any).ConditionExpression).toContain('attribute_not_exists');

        // Verify Update called to increment
        const updateCalls = ddbMock.calls().filter(c => c.args[0] instanceof UpdateCommand);
        expect(updateCalls).toHaveLength(1);
        expect((updateCalls[0].args[0].input as any).UpdateExpression).toContain('SET #count = #count + :one');
        expect((updateCalls[0].args[0].input as any).ConditionExpression).toBe('#count < :max');

        // Verify email content has commentaries
        const emailCall = (sendEmail as any).mock.calls[0][0];
        expect(emailCall.html).toContain('Pari Content');
    });

    it('should handle existing valid record (Put fails, Update succeeds)', async () => {
        process.env.STAGE = 'dev';
        // Simulate Put failure (record exists)
        ddbMock.on(PutCommand).rejects(conditionalCheckFailed);
        // Simulate Update success (under limit)
        ddbMock.on(UpdateCommand).resolves({});

        const result = await handler(createEvent('test@test.com'), {} as any, () => null);

        expect(result?.statusCode).toBe(200);

        // Put should have been attempted
        const putCalls = ddbMock.calls().filter(c => c.args[0] instanceof PutCommand);
        expect(putCalls).toHaveLength(1);

        // Update should have been attempted
        const updateCalls = ddbMock.calls().filter(c => c.args[0] instanceof UpdateCommand);
        expect(updateCalls).toHaveLength(1);
    });

    it('should block if limit reached (Put fails, Update fails)', async () => {
        process.env.STAGE = 'dev'; // Limit 5
        // Simulate Put failure (record exists)
        ddbMock.on(PutCommand).rejects(conditionalCheckFailed);
        // Simulate Update failure (limit reached)
        ddbMock.on(UpdateCommand).rejects(conditionalCheckFailed);

        const result = await handler(createEvent('test@test.com'), {} as any, () => null);

        expect(result?.statusCode).toBe(429);
        expect(JSON.parse(result?.body as string).message).toContain('can only send 5 sample emails');
    });

    it('should limit to 1 in prod', async () => {
        process.env.STAGE = 'prod'; // Limit 1

        // Case: Limit reached (already sent 1)
        ddbMock.on(PutCommand).rejects(conditionalCheckFailed);
        ddbMock.on(UpdateCommand).rejects(conditionalCheckFailed);

        const result = await handler(createEvent('test@test.com'), {} as any, () => null);

        expect(result?.statusCode).toBe(429);
        expect(JSON.parse(result?.body as string).message).toContain('1 sample email');

        // Verify max was 1 in condition
        const updateCalls = ddbMock.calls().filter(c => c.args[0] instanceof UpdateCommand);
        const exprValues = (updateCalls[0].args[0].input as any).ExpressionAttributeValues;
        expect(exprValues[':max']).toBe(1);
    });

    it('should reset if ttl expired (Put succeeds)', async () => {
        process.env.STAGE = 'dev';
        // Simulate Put success (because ttl < now condition passed)
        ddbMock.on(PutCommand).resolves({});
        // Simulate Update success
        ddbMock.on(UpdateCommand).resolves({});

        const result = await handler(createEvent('test@test.com'), {} as any, () => null);
        expect(result?.statusCode).toBe(200);

        // Put should have been called
        const putCalls = ddbMock.calls().filter(c => c.args[0] instanceof PutCommand);
        expect(putCalls).toHaveLength(1);
    });
});
