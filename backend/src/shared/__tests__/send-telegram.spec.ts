import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendToTelegramChannel } from '../send-telegram';
import * as secrets from '../secrets';
import { Kural } from '../email-templates';

// Mock the secrets module
vi.mock('../secrets', () => ({
    getSecret: vi.fn(),
}));

const mockGetSecret = vi.mocked(secrets.getSecret);

describe('sendToTelegramChannel', () => {
    const mockKural: Kural = {
        kuralId: 1,
        line1: 'அகர முதல எழுத்தெல்லாம் ஆதி',
        line2: 'பகவன் முதற்றே உலகு.',
        translation: 'A, as its first of letters, every speech maintains; The "Primal Deity" is first through all the world\'s domains.',
        explanation: 'The letter A is the first of all letters. So the eternal God is first in the world.',
        couplet: 'A, as its first of letters, every speech maintains;\nThe "Primal Deity" is first through all the world\'s domains.',
        transliteration: 'akara mutala ezhuththellaam aathi\npakavan muthattre ulaku',
        mk: '',
        mv: '',
        sp: '',
        pal: 'Arathupal',
        iyal: 'Payiram',
        adikaram: 'Kadavul Vazhthu',
        pal_tr: 'Virtue',
        iyal_tr: 'Prologue',
        pal_tl: 'Arathupal',
        iyal_tl: 'Payiram',
        adikaram_tl: 'Kadavul Vazhthu'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.STAGE = 'prod';
        process.env.APP_DOMAIN = 'https://test.site';

        // Clear fetch mock from global if it exists from other tests
        global.fetch = vi.fn();
    });



    it('should return false if secrets are missing', async () => {
        mockGetSecret.mockResolvedValueOnce(undefined); // Missing bot token

        const result = await sendToTelegramChannel(mockKural);

        expect(result).toBe(false);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should successfully post to Telegram and return true', async () => {
        mockGetSecret.mockResolvedValueOnce('mock_bot_token');
        mockGetSecret.mockResolvedValueOnce('mock_channel_id');

        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true, result: {} })
        });
        global.fetch = mockFetch;

        const result = await sendToTelegramChannel(mockKural);

        expect(result).toBe(true);
        expect(mockFetch).toHaveBeenCalledTimes(1);
        const fetchCallArgs = mockFetch.mock.calls[0];
        expect(fetchCallArgs[0]).toBe('https://api.telegram.org/botmock_bot_token/sendMessage');

        const body = JSON.parse(fetchCallArgs[1].body);
        expect(body.chat_id).toBe('mock_channel_id');
        expect(body.text).toContain('✨ <b>Thirukkural of the Day</b> ✨');
        expect(body.text).toContain('<b>குறள் 1</b>');
        expect(body.text).toContain('📕 <b>Arathupal</b> (Arathupal) — <i>Virtue</i>');
        expect(body.text).toContain(mockKural.line1);
        expect(body.text).toContain('https://test.site/kural/1');
    });

    it('should handle fetch failures gracefully without throwing', async () => {
        mockGetSecret.mockResolvedValueOnce('mock_bot_token');
        mockGetSecret.mockResolvedValueOnce('mock_channel_id');

        const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            text: async () => '{"ok":false,"error_code":400,"description":"Bad Request: chat not found"}'
        });
        global.fetch = mockFetch;

        const result = await sendToTelegramChannel(mockKural);

        expect(result).toBe(false);
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle raw exceptions gracefully without throwing', async () => {
        mockGetSecret.mockResolvedValueOnce('mock_bot_token');
        mockGetSecret.mockResolvedValueOnce('mock_channel_id');

        const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
        global.fetch = mockFetch;

        const result = await sendToTelegramChannel(mockKural);

        // Function guarantees not to throw inside the daily email loop
        expect(result).toBe(false);
    });
});
