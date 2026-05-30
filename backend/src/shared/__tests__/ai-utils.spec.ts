import { describe, expect, it } from 'vitest';
import { parseAiExplanationResponse } from '../ai-utils';

describe('parseAiExplanationResponse', () => {
    it('parses a clean JSON response', () => {
        const parsed = parseAiExplanationResponse('{"english":"Simple meaning","tamil":"எளிய விளக்கம்"}');

        expect(parsed).toEqual({
            english: 'Simple meaning',
            tamil: 'எளிய விளக்கம்',
        });
    });

    it('parses JSON wrapped in markdown fences', () => {
        const parsed = parseAiExplanationResponse(
            '```json\n{"english":"Simple meaning","tamil":"எளிய விளக்கம்"}\n```'
        );

        expect(parsed.english).toBe('Simple meaning');
        expect(parsed.tamil).toBe('எளிய விளக்கம்');
    });

    it('parses the first JSON object when extra text follows', () => {
        const parsed = parseAiExplanationResponse(
            '{"english":"Simple meaning","tamil":"எளிய விளக்கம்"}\n\nThis explanation highlights discipline.'
        );

        expect(parsed.english).toBe('Simple meaning');
        expect(parsed.tamil).toBe('எளிய விளக்கம்');
    });

    it('throws when required fields are missing', () => {
        expect(() => parseAiExplanationResponse('{"english":"Only one field"}')).toThrow(
            'Gemini response is missing required english/tamil fields'
        );
    });
});
