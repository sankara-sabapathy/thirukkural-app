import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from '../razorpay-handler';
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

    beforeEach(() => {
        ddbMock.reset();
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
});
