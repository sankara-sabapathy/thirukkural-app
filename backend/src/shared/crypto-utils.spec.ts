import { generateUnsubscribeToken, verifyUnsubscribeToken } from './crypto-utils';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as secrets from './secrets';

// Mock secrets module
vi.mock('./secrets', () => ({
    getSecret: vi.fn(),
}));

describe('Crypto Utils', () => {

    beforeEach(() => {
        vi.resetAllMocks();
        // Default mock behavior
        vi.mocked(secrets.getSecret).mockResolvedValue('test-secret');
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should generate a token', async () => {
        const token = await generateUnsubscribeToken('test@example.com');
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
    });

    it('should verify a valid token', async () => {
        const email = 'test@example.com';
        const token = await generateUnsubscribeToken(email);
        const verifiedEmail = await verifyUnsubscribeToken(token);
        expect(verifiedEmail).toBe(email);
    });

    it('should return null for invalid signature', async () => {
        const email = 'test@example.com';
        const token = await generateUnsubscribeToken(email);

        // Tamper with the token (base64 decode, change signature, encode)
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const parts = decoded.split(':');
        parts[parts.length - 1] = 'invalid_sig';
        const tamperedToken = Buffer.from(parts.join(':')).toString('base64');

        const result = await verifyUnsubscribeToken(tamperedToken);
        expect(result).toBeNull();
    });

    it('should return null for expired token', async () => {
        const email = 'expired@example.com';

        // Mock Date.now to return future time
        vi.useFakeTimers();
        const now = 1000000000000;
        vi.setSystemTime(now);

        const token = await generateUnsubscribeToken(email);

        // Advance time by 24h + 1ms
        vi.setSystemTime(now + 24 * 60 * 60 * 1000 + 1);

        const result = await verifyUnsubscribeToken(token);
        expect(result).toBeNull();
    });
});
