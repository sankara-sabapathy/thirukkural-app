import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, DeleteCommand, DeleteCommandInput } from '@aws-sdk/lib-dynamodb';
import * as webpush from 'web-push';
import { handler } from '../send-daily-email';

// Mock dependencies
const ddbMock = mockClient(DynamoDBDocumentClient);

vi.mock('../../shared/kural-utils', () => ({
    getRandomKural: vi.fn(),
}));
vi.mock('../../shared/email-service', () => ({
    sendEmail: vi.fn(),
}));
vi.mock('../../shared/crypto-utils', () => ({
    generateUnsubscribeToken: vi.fn().mockReturnValue('mock-token'),
}));
vi.mock('web-push', () => ({
    sendNotification: vi.fn(),
    setVapidDetails: vi.fn(),
}));

import { getRandomKural } from '../../shared/kural-utils';
import { sendEmail } from '../../shared/email-service';

describe('Send Daily Email Handler', () => {
    const originalEnv = process.env;

    const mockKural = {
        kuralId: 1337,
        line1: 'Line 1',
        line2: 'Line 2',
        translation: 'Trans',
        explanation: 'Exp',
        mk: 'mk', mv: 'mv', sp: 'sp'
    };

    beforeEach(() => {
        ddbMock.reset();
        vi.resetAllMocks();

        process.env = {
            ...originalEnv,
            USERS_TABLE: 'UsersTable',
            PUSH_SUBSCRIPTIONS_TABLE: 'PushTable',
            VAPID_PUBLIC_KEY: 'pub',
            VAPID_PRIVATE_KEY: 'priv',
            VAPID_SUBJECT: 'sub',
            APP_DOMAIN: 'https://test.com'
        };

        (getRandomKural as any).mockResolvedValue(mockKural);

        // Default mock for ScanCommand to avoid undefined errors
        ddbMock.on(ScanCommand).resolves({ Items: [] });
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should skip if random kural is not found', async () => {
        (getRandomKural as any).mockResolvedValue(null);
        await handler();
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it('should send emails to subscribed users', async () => {
        // Mock DB Scan for Users
        ddbMock.on(ScanCommand, { TableName: 'UsersTable' }).resolves({
            Items: [{ email: 'user1@test.com' }, { email: 'user2@test.com' }]
        });

        // Mock DB Scan for Push (empty)
        ddbMock.on(ScanCommand, { TableName: 'PushTable' }).resolves({ Items: [] });

        await handler();

        expect(sendEmail).toHaveBeenCalledTimes(2);
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: ['user1@test.com'] }));
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: ['user2@test.com'] }));
    });

    it('should send push notifications', async () => {
        // Mock DB Scan for Users (empty)
        ddbMock.on(ScanCommand, { TableName: 'UsersTable' }).resolves({ Items: [] });

        // Mock DB Scan for Push
        ddbMock.on(ScanCommand, { TableName: 'PushTable' }).resolves({
            Items: [
                { deviceId: 'd1', subscription: { endpoint: 'e1' } }
            ]
        });

        await handler();

        expect(webpush.setVapidDetails).toHaveBeenCalledWith('sub', 'pub', 'priv');
        expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
        expect(webpush.sendNotification).toHaveBeenCalledWith(
            { endpoint: 'e1' },
            expect.stringContaining('Thirukkural #1337')
        );

        // Verify TTL update
        expect(ddbMock.calls()).toHaveLength(3); // Scan Users, Scan Push, Update Push
        const updateCall = ddbMock.calls().find(c => c.args[0] instanceof UpdateCommand);
        expect(updateCall).toBeDefined();
    });

    it('should delete expired push subscriptions (410)', async () => {
        ddbMock.on(ScanCommand, { TableName: 'UsersTable' }).resolves({ Items: [] });
        ddbMock.on(ScanCommand, { TableName: 'PushTable' }).resolves({
            Items: [{ deviceId: 'd1', subscription: { endpoint: 'e1' } }]
        });

        const error410 = new Error('Gone') as any;
        error410.statusCode = 410;
        (webpush.sendNotification as any).mockRejectedValue(error410);

        await handler();

        const deleteCall = ddbMock.calls().find(c => c.args[0] instanceof DeleteCommand);
        expect(deleteCall).toBeDefined();
        expect((deleteCall?.args[0].input as DeleteCommandInput).Key).toEqual({ deviceId: 'd1' });
    });
});
