import { createHmac } from 'crypto';

export const generateUnsubscribeToken = (email: string): string => {
    const secret = process.env.UNSUBSCRIBE_SECRET;
    if (!secret) {
        throw new Error('UNSUBSCRIBE_SECRET is not defined');
    }

    const expiryFn = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    const data = `${email}:${expiryFn}`;
    const signature = createHmac('sha256', secret).update(data).digest('hex');

    // Encode email and expiry + signature to restore them later
    // Format: email:expiry:signature (Base64 encoded)
    return Buffer.from(`${data}:${signature}`).toString('base64');
};

export const verifyUnsubscribeToken = (token: string): string | null => {
    const secret = process.env.UNSUBSCRIBE_SECRET;
    if (!secret) {
        console.error('UNSUBSCRIBE_SECRET is not defined');
        return null; // Fail safe
    }

    try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const parts = decoded.split(':');

        // Basic format check: email:expiry:signature
        // Note: Email can contain ':', so we should pop the last two elements
        if (parts.length < 3) return null;

        const signature = parts.pop();
        const expiryStr = parts.pop();
        const email = parts.join(':'); // Rejoin the rest as email

        if (!signature || !expiryStr || !email) return null;

        const expiry = parseInt(expiryStr, 10);
        if (isNaN(expiry)) return null;

        if (Date.now() > expiry) {
            console.warn(`Unsubscribe token expired for ${email}`);
            return null;
        }

        // Re-compute signature
        const data = `${email}:${expiryStr}`;
        const expectedSignature = createHmac('sha256', secret).update(data).digest('hex');

        if (signature !== expectedSignature) {
            console.warn(`Invalid unsubscribe signature for ${email}`);
            return null;
        }

        return email;
    } catch (err) {
        console.error('Error verifying unsubscribe token:', err);
        return null;
    }
};
