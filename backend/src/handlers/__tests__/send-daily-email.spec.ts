import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, DeleteCommand, DeleteCommandInput } from '@aws-sdk/lib-dynamodb';
import * as webpush from 'web-push';
import { handler } from '../send-daily-email';
import * as secrets from '../../shared/secrets';

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
vi.mock('../../shared/secrets', () => ({
    getSecret: vi.fn(),
}));
vi.mock('../../shared/ai-utils', () => ({
    getOrGenerateAiExplanation: vi.fn(),
}));

import { getRandomKural } from '../../shared/kural-utils';
import { sendEmail } from '../../shared/email-service';
import { getOrGenerateAiExplanation } from '../../shared/ai-utils';

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
            // VAPID_PRIVATE_KEY is now a secret
            VAPID_SUBJECT: 'sub',
            APP_DOMAIN: 'https://test.com'
        };

        // Default mock for getSecret
        vi.mocked(secrets.getSecret).mockResolvedValue('priv');
        vi.mocked(getOrGenerateAiExplanation).mockResolvedValue(null);

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
            Items: [{ email: 'user1@test.com', subscriptionStatus: 'active' }, { email: 'user2@test.com', credits: 10 }]
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

        expect(secrets.getSecret).toHaveBeenCalledWith('PARAM_VAPID_PRIVATE_KEY');
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

    it('should skip email and send OUT_OF_CREDITS alert if credits are insufficient', async () => {
        process.env.ENABLE_PAYMENTS = 'true';
        ddbMock.on(ScanCommand, { TableName: 'UsersTable' }).resolves({
            Items: [{ userId: 'uid1', email: 'poor@test.com', credits: 0, outOfCreditAlertSent: false }]
        });
        ddbMock.on(ScanCommand, { TableName: 'PushTable' }).resolves({ Items: [] });

        // Force ConditionalCheckFailedException on the deduction update
        const conditionalCheckFailed = new Error('ConditionalCheckFailedException');
        conditionalCheckFailed.name = 'ConditionalCheckFailedException';
        ddbMock.on(UpdateCommand).rejects(conditionalCheckFailed); // Initial attempt fails

        // But we need the subsequent lock update to succeed.
        ddbMock.on(UpdateCommand).callsFake((input) => {
            if (input.UpdateExpression.includes('credits = credits - :cost')) {
                return Promise.reject(conditionalCheckFailed);
            }
            return Promise.resolve({}); // The lock update succeeds
        });

        await handler();

        // One email sent -> the alert
        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            to: ['poor@test.com'],
            subject: expect.stringContaining('Delivery Paused: Out of Credits')
        }));

        // Verify the DB lock was applied
        const updates = ddbMock.calls().filter(c => c.args[0] instanceof UpdateCommand && (c.args[0].input as any).UpdateExpression.includes('outOfCreditAlertSent'));
        expect(updates).toHaveLength(1);
    });

    it('should send daily email and then send LOW_CREDITS alert if balance drops below threshold', async () => {
        process.env.ENABLE_PAYMENTS = 'true';
        ddbMock.on(ScanCommand, { TableName: 'UsersTable' }).resolves({
            Items: [{ userId: 'uid2', email: 'low@test.com', credits: 5, lowCreditAlertSent: false }]
        });
        ddbMock.on(ScanCommand, { TableName: 'PushTable' }).resolves({ Items: [] });

        // The deduction update succeeds and returns the new balance (4)
        ddbMock.on(UpdateCommand).resolves({
            Attributes: { credits: 4 }
        });

        await handler();

        // Two emails sent: standard daily kural + low credit alert
        expect(sendEmail).toHaveBeenCalledTimes(2);

        // Let's check the contents of the final email which should be the alert
        const calls = vi.mocked(sendEmail).mock.calls;
        const subjects = calls.map(c => c[0].subject);

        expect(subjects.some(s => s.includes('Running Low on Credits'))).toBe(true);
        expect(subjects.some(s => s.includes('Thirukkural #1337'))).toBe(true);

        // Verify the DB lock was applied
        const updates = ddbMock.calls().filter(c => c.args[0] instanceof UpdateCommand && (c.args[0].input as any).UpdateExpression.includes('lowCreditAlertSent'));
        expect(updates).toHaveLength(1);
    });
});
