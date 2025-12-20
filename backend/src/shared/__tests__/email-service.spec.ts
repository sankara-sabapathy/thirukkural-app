import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { SESClient, SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses';
import { sendEmail, EmailOptions } from '../email-service';

const sesMock = mockClient(SESClient);

// Mock global fetch for Brevo
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe('Email Service', () => {
    const defaultOptions: EmailOptions = {
        to: ['test@example.com'],
        subject: 'Test Subject',
        text: 'Test Text',
        html: '<p>Test HTML</p>'
    };

    const originalEnv = process.env;

    beforeEach(() => {
        sesMock.reset();
        fetchMock.mockReset();
        process.env = { ...originalEnv }; // Reset env vars
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('AWS SES Provider', () => {
        it('should send email using SES when provider is not specified', async () => {
            delete process.env.EMAIL_PROVIDER;
            process.env.SES_SENDER = 'sender@example.com';

            sesMock.on(SendEmailCommand).resolves({});

            await sendEmail(defaultOptions);

            expect(sesMock.calls()).toHaveLength(1);
            const callArgs = sesMock.call(0).args[0].input as SendEmailCommandInput;
            expect(callArgs.Destination?.ToAddresses).toEqual(defaultOptions.to);
            expect(callArgs.Source).toBe('sender@example.com');
            expect(callArgs.Message?.Body?.Html?.Data).toBe(defaultOptions.html);
        });

        it('should use default sender if SES_SENDER is not set', async () => {
            delete process.env.EMAIL_PROVIDER;
            delete process.env.SES_SENDER;
            delete process.env.EMAIL_SENDER_ADDRESS;

            sesMock.on(SendEmailCommand).resolves({});

            await sendEmail(defaultOptions);

            const callArgs = sesMock.call(0).args[0].input as SendEmailCommandInput;
            expect(callArgs.Source).toBe('noreply@example.com');
        });
    });

    describe('Brevo Provider', () => {
        beforeEach(() => {
            process.env.EMAIL_PROVIDER = 'BREVO';
            process.env.BREVO_API_KEY = 'test-api-key';
        });

        it('should send email using Brevo API', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                status: 201,
                statusText: 'Created'
            });

            await sendEmail(defaultOptions);

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock).toHaveBeenCalledWith('https://api.brevo.com/v3/smtp/email', expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'api-key': 'test-api-key'
                })
            }));

            const body = JSON.parse(fetchMock.mock.calls[0][1].body);
            expect(body.to[0].email).toBe('test@example.com');
            expect(body.subject).toBe('Test Subject');
        });

        it('should throw error if BREVO_API_KEY is missing', async () => {
            delete process.env.BREVO_API_KEY;
            await expect(sendEmail(defaultOptions)).rejects.toThrow('BREVO_API_KEY is not configured');
        });

        it('should throw error if Brevo API fails', async () => {
            fetchMock.mockResolvedValue({
                ok: false,
                status: 400,
                statusText: 'Bad Request',
                text: () => Promise.resolve('Invalid email')
            });

            await expect(sendEmail(defaultOptions)).rejects.toThrow('Brevo API Error: 400 Bad Request - Invalid email');
        });
    });
});
