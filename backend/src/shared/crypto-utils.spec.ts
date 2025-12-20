import { generateUnsubscribeToken, verifyUnsubscribeToken } from './crypto-utils';
import { describe, it, expect, beforeAll, vi } from 'vitest';

describe('Crypto Utils', () => {
    beforeAll(() => {
        process.env.UNSUBSCRIBE_SECRET = 'test-secret';
    });

    it('should generate a token', () => {
        const token = generateUnsubscribeToken('test@example.com');
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
    });

    it('should verify a valid token', () => {
        const email = 'test@example.com';
        const token = generateUnsubscribeToken(email);
        const verifiedEmail = verifyUnsubscribeToken(token);
        expect(verifiedEmail).toBe(email);
    });

    it('should return null for invalid signature', () => {
        const email = 'test@example.com';
        const token = generateUnsubscribeToken(email);

        // Tamper with the token (base64 decode, change signature, encode)
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const parts = decoded.split(':');
        parts[parts.length - 1] = 'invalid_sig';
        const tamperedToken = Buffer.from(parts.join(':')).toString('base64');

        const result = verifyUnsubscribeToken(tamperedToken);
        expect(result).toBeNull();
    });

    it('should return null for expired token', () => {
        const email = 'expired@example.com';

        // Mock Date.now to return future time
        vi.useFakeTimers();
        const now = 1000000000000;
        vi.setSystemTime(now);

        const token = generateUnsubscribeToken(email);

        // Advance time by 24h + 1ms
        vi.setSystemTime(now + 24 * 60 * 60 * 1000 + 1);

        const result = verifyUnsubscribeToken(token);
        expect(result).toBeNull();

        vi.useRealTimers();
    });
});
