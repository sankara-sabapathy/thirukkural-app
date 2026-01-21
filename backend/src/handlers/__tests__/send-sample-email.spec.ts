import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
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
        translation: 'Test Translation',
        mk: 'mk', mv: 'mv', sp: 'sp'
    };

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
        ddbMock.on(GetCommand).resolves({});

        const result = await handler(createEvent('test@test.com'), {} as any, () => null);

        expect(result?.statusCode).toBe(200);

        expect(ddbMock.calls()).toHaveLength(2); // Get, Put
        const putCall = ddbMock.calls().find(c => c.args[0] instanceof PutCommand);
        expect(putCall).toBeDefined();
        const item = (putCall?.args[0].input as any).Item;
        expect(item.count).toBe(1);
    });

    it('should limit to 1 in prod', async () => {
        process.env.STAGE = 'prod';

        // Mock existing record with count 1
        ddbMock.on(GetCommand).resolves({
            Item: { pk: 'email:test@test.com', ttl: Math.floor(Date.now() / 1000) + 1000, count: 1 }
        });

        const result = await handler(createEvent('test@test.com'), {} as any, () => null);

        expect(result?.statusCode).toBe(429);
        expect(JSON.parse(result?.body as string).message).toContain('1 sample email');
    });

    it('should limit to 5 in dev/non-prod', async () => {
        process.env.STAGE = 'dev';

        // Mock existing record with count 4
        ddbMock.on(GetCommand).resolves({
            Item: { pk: 'email:test@test.com', ttl: Math.floor(Date.now() / 1000) + 1000, count: 4 }
        });

        const result = await handler(createEvent('test@test.com'), {} as any, () => null);
        expect(result?.statusCode).toBe(200);

        // Should increment
        const putCall = ddbMock.calls().filter(c => c.args[0] instanceof PutCommand);
        // Expect last put command
        const lastPut = putCall[putCall.length - 1];
        const item = (lastPut?.args[0].input as any).Item;
        expect(item.count).toBe(5);
    });

    it('should block 6th request in dev', async () => {
        process.env.STAGE = 'dev';

        // Mock existing record with count 5
        ddbMock.on(GetCommand).resolves({
            Item: { pk: 'email:test@test.com', ttl: Math.floor(Date.now() / 1000) + 1000, count: 5 }
        });

        const result = await handler(createEvent('test@test.com'), {} as any, () => null);
        expect(result?.statusCode).toBe(429);
        expect(JSON.parse(result?.body as string).message).toContain('5 sample emails');
    });

    it('should reset if ttl expired', async () => {
        process.env.STAGE = 'dev';

        // Mock existing record with count 5 but EXPIRED ttl
        ddbMock.on(GetCommand).resolves({
            Item: { pk: 'email:test@test.com', ttl: Math.floor(Date.now() / 1000) - 100, count: 5 }
        });

        const result = await handler(createEvent('test@test.com'), {} as any, () => null);
        expect(result?.statusCode).toBe(200);

        // Should reset count to 1
        const putCall = ddbMock.calls().find(c => c.args[0] instanceof PutCommand);
        const item = (putCall?.args[0].input as any).Item;
        expect(item.count).toBe(1);
    });
});
