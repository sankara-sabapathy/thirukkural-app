import { describe, it, expect } from 'vitest';
import { generateKuralEmail, Kural } from '../email-templates';

describe('Email Templates', () => {
    const mockKural: Kural = {
        kuralId: 1,
        line1: 'Line 1 Text',
        line2: 'Line 2 Text',
        translation: 'Translation Text',
        explanation: 'Explanation Text',
        couplet: 'Couplet Text',
        mk: 'MK Explanation',
        mv: 'MV Explanation',
        sp: 'SP Explanation'
    };

    it('should generate correct email content for subscribed user', () => {
        const result = generateKuralEmail(mockKural, false, 'http://unsubscribe.com');

        expect(result.subject).toContain('Thirukkural #1');
        expect(result.text).toContain('Line 1 Text');
        expect(result.text).toContain('To unsubscribe, click the link below');
        expect(result.html).toContain('http://unsubscribe.com');
        expect(result.html).toContain('MK Explanation'); // Check if explanations are present
    });

    it('should generate correct email content for sample email', () => {
        const result = generateKuralEmail(mockKural, true);

        expect(result.text).toContain('This is a one-time sample email');
        expect(result.html).not.toContain('http://unsubscribe.com'); // Should not have unsubscribe link in sample
        expect(result.html).toContain('This is a sample email');
    });

    it('should handle missing explanations gracefully', () => {
        const minimalKural: Kural = {
            kuralId: 2,
            line1: 'L1',
            line2: 'L2',
            translation: 'Trans'
        };

        const result = generateKuralEmail(minimalKural);

        expect(result.html).toContain('L1');
        expect(result.html).not.toContain('Mu. Karunanidhi'); // Should not render headers if content missing
    });
});
