import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from '../user-profile';
import { sendEmail } from '../../shared/email-service';

vi.mock('../../shared/email-service', () => ({
    sendEmail: vi.fn(),
}));

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('User Profile Handler', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        ddbMock.reset();
        process.env = { ...originalEnv, USERS_TABLE: 'TestUsersTable' };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should create new user with daily email disabled by default', async () => {
        // Mock GetCommand to return empty (user not found)
        ddbMock.on(GetCommand).resolves({});

        // Mock PutCommand and QueryCommand
        ddbMock.on(PutCommand).resolves({});
        ddbMock.on(QueryCommand).resolves({ Items: [] });

        const event = {
            httpMethod: 'GET',
            headers: { origin: 'http://localhost:3000' },
            requestContext: {
                authorizer: {
                    claims: {
                        sub: 'test-user-id',
                        email: 'test@example.com'
                    }
                }
            }
        } as any;

        const result = await handler(event);

        expect(result.statusCode).toBe(200);

        // Verify PutCommand was called with correct default
        expect(ddbMock.calls()).toHaveLength(4); // Get + Query + Put (Profile) + Put (Auth Link)
        const putCalls = ddbMock.calls().filter(call => call.args[0] instanceof PutCommand);
        expect(putCalls).toHaveLength(2);

        const putProfileInput = putCalls[0].args[0].input as any;
        expect(putProfileInput.Item.type).toBe('PROFILE');
        expect(putProfileInput.Item.receiveDailyEmail).toBe(false); // crucial check

        const putLinkInput = putCalls[1].args[0].input as any;
        expect(putLinkInput.Item.type).toBe('AUTH_LINK');
        expect(putLinkInput.Item.userId).toBe('test-user-id');

        const body = JSON.parse(result.body);
        expect(body.receiveDailyEmail).toBe(false);

        // Verify that the WELCOME_NEW_USER system email was dispatched
        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            to: ['test@example.com'],
            subject: expect.stringContaining('Welcome to Thirukkural Daily')
        }));
    });

    it('should return existing user profile without modifying it', async () => {
        const existingUser = {
            userId: 'existing-user',
            email: 'existing@example.com',
            receiveDailyEmail: true, // User explicitly opted in previously
            type: 'PROFILE', // Ensure it doesn't trigger lazy migration
            createdAt: '2023-01-01T00:00:00.000Z'
        };

        ddbMock.on(GetCommand).resolves({ Item: existingUser });

        const event = {
            httpMethod: 'GET',
            headers: { origin: 'http://localhost:3000' },
            requestContext: {
                authorizer: {
                    claims: {
                        sub: 'existing-user',
                        email: 'existing@example.com'
                    }
                }
            }
        } as any;

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual(existingUser);

        // Should not call PutCommand
        const putCalls = ddbMock.calls().filter(call => call.args[0] instanceof PutCommand);
        expect(putCalls).toHaveLength(0);
    });
});
