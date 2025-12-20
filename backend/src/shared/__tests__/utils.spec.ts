import { describe, it, expect } from 'vitest';
import { createResponse, ALLOWED_ORIGINS } from '../utils';

describe('Utils', () => {
    describe('createResponse', () => {
        it('should create success response with default CORS', () => {
            const result = createResponse(200, { message: 'ok' });

            expect(result.statusCode).toBe(200);
            expect(result.headers?.['Access-Control-Allow-Origin']).toBe(ALLOWED_ORIGINS[0]);
            expect(JSON.parse(result.body)).toEqual({ message: 'ok' });
        });

        it('should allow valid origin', () => {
            const validOrigin = ALLOWED_ORIGINS[0];
            const result = createResponse(200, {}, validOrigin);

            expect(result.headers?.['Access-Control-Allow-Origin']).toBe(validOrigin);
        });

        it('should default to first origin for invalid origin', () => {
            const result = createResponse(200, {}, 'http://hacker.com');

            expect(result.headers?.['Access-Control-Allow-Origin']).toBe(ALLOWED_ORIGINS[0]);
        });
    });
});
