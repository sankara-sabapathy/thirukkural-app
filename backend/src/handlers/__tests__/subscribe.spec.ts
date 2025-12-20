import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand, PutCommandInput } from '@aws-sdk/lib-dynamodb';
import { handler } from '../subscribe';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('Subscribe Handler', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        ddbMock.reset();
        process.env = { ...originalEnv, SUBSCRIBER_TABLE: 'TestTable' };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should subscribe successfully with valid email', async () => {
        ddbMock.on(PutCommand).resolves({});

        const event = {
            body: JSON.stringify({ email: 'test@example.com' })
        } as any;

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ message: 'Subscribed successfully' });

        expect(ddbMock.calls()).toHaveLength(1);
        const input = ddbMock.call(0).args[0].input as PutCommandInput;
        expect(input.TableName).toBe('TestTable');
        expect(input.Item?.email).toBe('test@example.com');
        expect(input.Item?.subscribed).toBe(true);
    });

    it('should return 400 for missing email', async () => {
        const event = {
            body: JSON.stringify({})
        } as any;

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).message).toBe('Email required');
    });

    it('should return 400 for invalid email format', async () => {
        const event = {
            body: JSON.stringify({ email: 'invalid-email' })
        } as any;

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).message).toBe('Invalid email format');
    });

    it('should return 500 on dynamo error', async () => {
        ddbMock.on(PutCommand).rejects(new Error('Dynamo fail'));

        const event = {
            body: JSON.stringify({ email: 'test@example.com' })
        } as any;

        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).message).toBe('Internal server error');
    });
});
