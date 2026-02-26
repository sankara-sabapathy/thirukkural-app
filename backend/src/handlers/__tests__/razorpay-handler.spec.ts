import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { handler as _handler } from '../razorpay-handler'; // Types mostly, replaced in beforeEach
import { sendEmail } from '../../shared/email-service';
import * as secrets from '../../shared/secrets';

vi.mock('../../shared/email-service', () => ({
    sendEmail: vi.fn(),
}));

vi.mock('razorpay', () => {
    const RazorpayMock = vi.fn().mockImplementation(function () {
        return {
            orders: {
                create: vi.fn().mockResolvedValue({ id: 'order_123', amount: 50000, currency: 'INR' })
            },
            subscriptions: {
                create: vi.fn().mockResolvedValue({ id: 'sub_123', short_url: 'http://rzp.io/1' }),
                cancel: vi.fn().mockResolvedValue({ id: 'sub_123', status: 'cancelled' })
            }
        };
    });
    return { default: RazorpayMock };
});

vi.mock('razorpay/dist/utils/razorpay-utils', () => ({
    validateWebhookSignature: vi.fn().mockReturnValue(true)
}));

vi.mock('../../shared/secrets', () => ({
    getSecret: vi.fn(),
}));

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('Razorpay Handler', () => {
    const originalEnv = process.env;
    let handler: any;

    beforeEach(async () => {
        ddbMock.reset();
        vi.clearAllMocks();
        vi.resetModules(); // Hard wipe Razorpay client cache and global configs
        vi.clearAllMocks();

        process.env = {
            ...originalEnv,
            USERS_TABLE: 'TestUsersTable'
        };

        (secrets.getSecret as any).mockImplementation(async (key: string) => {
            if (key === 'PARAM_RAZORPAY_KEY_ID') return 'key_id';
            if (key === 'PARAM_RAZORPAY_KEY_SECRET') return 'key_secret';
            if (key === 'PARAM_RAZORPAY_WEBHOOK_SECRET') return 'wh_secret';
            return null;
        });

        const module = await import('../razorpay-handler');
        handler = module.handler;
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should handle payment.captured webhook and send CREDITS_ADDED email', async () => {
        const event = {
            path: '/payment/webhook',
            httpMethod: 'POST',
            headers: { 'x-razorpay-signature': 'valid_sig' },
            body: JSON.stringify({
                event: 'payment.captured',
                payload: {
                    payment: {
                        entity: {
                            id: 'pay_123',
                            amount: 10000, // 100 INR
                            currency: 'INR',
                            notes: { type: 'CREDIT_PACK', userId: 'usr1' }
                        }
                    }
                }
            })
        } as any;

        ddbMock.on(UpdateCommand).resolves({
            Attributes: { email: 'user@test.com', credits: 105 }
        });

        const result = await handler(event);

        expect(result.statusCode).toBe(200);

        const updates = ddbMock.calls().filter(c => c.args[0] instanceof UpdateCommand);
        expect(updates).toHaveLength(1);
        const updateInput = updates[0].args[0].input as any;
        expect(updateInput.UpdateExpression).toContain('ADD processedPayments');
        expect(updateInput.UpdateExpression).toContain('lowCreditAlertSent');

        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            to: ['user@test.com'],
            subject: expect.stringContaining('Credits Added Successfully')
        }));
    });

    it('should handle subscription.charged webhook and send WELCOME_PLUS email', async () => {
        const event = {
            path: '/payment/webhook',
            httpMethod: 'POST',
            headers: { 'x-razorpay-signature': 'valid_sig' },
            body: JSON.stringify({
                event: 'subscription.charged',
                payload: {
                    subscription: {
                        entity: {
                            id: 'sub_123',
                            current_end: 1700000000,
                            paid_count: 1,
                            plan_id: 'plan_monthly',
                            notes: { userId: 'usr2' }
                        }
                    },
                    payment: { entity: { id: 'pay_sub' } }
                }
            })
        } as any;

        ddbMock.on(UpdateCommand).resolves({
            Attributes: { email: 'sub@test.com' }
        });

        const result = await handler(event);
        expect(result.statusCode).toBe(200);

        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            to: ['sub@test.com'],
            subject: expect.stringContaining('Welcome to Thirukkural Plus')
        }));
    });

    it('should handle subscription.charged webhook on renewal and NOT send WELCOME_PLUS email', async () => {
        const event = {
            path: '/payment/webhook',
            httpMethod: 'POST',
            headers: { 'x-razorpay-signature': 'valid_sig' },
            body: JSON.stringify({
                event: 'subscription.charged',
                payload: {
                    subscription: {
                        entity: {
                            id: 'sub_123',
                            current_end: 1700000000,
                            paid_count: 2, // Renewal
                            plan_id: 'plan_monthly',
                            notes: { userId: 'usr2_renew' }
                        }
                    },
                    payment: { entity: { id: 'pay_sub_renew' } }
                }
            })
        } as any;

        ddbMock.on(UpdateCommand).resolves({
            Attributes: { email: 'sub_renew@test.com' }
        });

        const result = await handler(event);
        expect(result.statusCode).toBe(200);

        expect(sendEmail).toHaveBeenCalledTimes(0);
    });

    it('should handle subscription.halted webhook and send PAYMENT_FAILED email', async () => {
        const event = {
            path: '/payment/webhook',
            httpMethod: 'POST',
            headers: { 'x-razorpay-signature': 'valid_sig' },
            body: JSON.stringify({
                event: 'subscription.halted',
                payload: {
                    subscription: {
                        entity: {
                            id: 'sub_123',
                            status: 'halted',
                            notes: { userId: 'usr3' }
                        }
                    }
                }
            })
        } as any;

        ddbMock.on(UpdateCommand).resolves({
            Attributes: { email: 'halt@test.com' }
        });

        const result = await handler(event);
        expect(result.statusCode).toBe(200);

        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            to: ['halt@test.com'],
            subject: expect.stringContaining('Subscription Paused')
        }));
    });

    it('should send SUBSCRIPTION_CANCELLED email on subscription.cancelled (manual cancellation)', async () => {
        const event = {
            path: '/payment/webhook',
            httpMethod: 'POST',
            headers: { 'x-razorpay-signature': 'valid_sig' },
            body: JSON.stringify({
                event: 'subscription.cancelled',
                payload: {
                    subscription: {
                        entity: {
                            id: 'sub_123',
                            status: 'cancelled',
                            notes: { userId: 'usr4' }
                        }
                    }
                }
            })
        } as any;

        ddbMock.on(UpdateCommand).resolves({
            Attributes: { email: 'cancel@test.com' }
        });

        const result = await handler(event);
        expect(result.statusCode).toBe(200);

        // Verification: Email should be sent for manual cancellations now
        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            to: ['cancel@test.com'],
            subject: expect.stringContaining('Subscription Cancelled')
        }));
    });

    it('should proceed to sync local database to cancelled even if Razorpay cancel returns 400', async () => {
        const RazorpayClient = (await import('razorpay')).default;
        const mockRzpInt = new RazorpayClient({ key_id: '1', key_secret: '1' });

        mockRzpInt.subscriptions.cancel = vi.fn().mockRejectedValue({ statusCode: 400, error: { code: 'BAD_REQUEST_ERROR' } });

        const event = {
            path: '/payment/cancel',
            httpMethod: 'POST',
            requestContext: { authorizer: { claims: { sub: 'usr5' } } },
            headers: {}
        } as any;

        // Mock GetCommand to return an active subscription
        const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
        ddbMock.on(GetCommand).resolves({
            Item: { userId: 'usr5', subscriptionId: 'sub_active_123', subscriptionStatus: 'active' }
        });

        const result = await handler(event);

        // Assert we still returned 200 explicitly to frontend to unblock user
        expect(result.statusCode).toBe(200);

        // Assert DB was still updated
        const updates = ddbMock.calls().filter(c => c.args[0] instanceof UpdateCommand);
        expect(updates.length).toBeGreaterThan(0);
        const input = updates[updates.length - 1].args[0].input as any;
        expect(input.UpdateExpression).toContain('subscriptionStatus = :status');
        expect(input.ExpressionAttributeValues[':status']).toBe('cancelled');
    });

    it('should return already_processed for duplicate payment.captured events', async () => {
        const event = {
            path: '/payment/webhook',
            httpMethod: 'POST',
            headers: { 'x-razorpay-signature': 'valid_sig' },
            body: JSON.stringify({
                event: 'payment.captured',
                payload: {
                    payment: {
                        entity: {
                            id: 'pay_123',
                            amount: 10000,
                            currency: 'INR',
                            notes: { type: 'CREDIT_PACK', userId: 'usr1' }
                        }
                    }
                }
            })
        } as any;

        // Simulate Idempotent locking Error
        const checkFailedError = new Error('The conditional request failed') as any;
        checkFailedError.name = 'ConditionalCheckFailedException';
        ddbMock.on(UpdateCommand).rejects(checkFailedError);

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body).status).toBe('already_processed');
    });

    it('should return 400 for invalid signature on webhook', async () => {
        const utils = await import('razorpay/dist/utils/razorpay-utils');
        (utils.validateWebhookSignature as any).mockReturnValueOnce(false);

        const event = {
            path: '/payment/webhook',
            httpMethod: 'POST',
            headers: { 'x-razorpay-signature': 'invalid_sig' },
            body: JSON.stringify({ event: 'payment.captured', payload: {} })
        } as any;

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).message).toBe('Invalid signature');
    });

    it('should resolve AuthLink records internally seamlessly', async () => {
        const event = {
            path: '/payment/cancel',
            httpMethod: 'POST',
            requestContext: { authorizer: { claims: { sub: 'legacy_sub' } } },
            headers: {}
        } as any;

        const { GetCommand } = await import('@aws-sdk/lib-dynamodb');

        // Mock the Auth Link Check
        ddbMock.on(GetCommand).callsFake((params: any) => {
            if (params.Key.userId === 'legacy_sub') {
                return Promise.resolve({ Item: { type: 'AUTH_LINK', linkedUserId: 'internal_user_123' } });
            }
            if (params.Key.userId === 'internal_user_123') {
                return Promise.resolve({ Item: { userId: 'internal_user_123', subscriptionId: 'sub_123', subscriptionStatus: 'active' } });
            }
            return Promise.resolve({});
        });

        const result = await handler(event);

        // Verify it didn't crash and resolved the profile
        expect(result.statusCode).toBe(200);
    });
});
