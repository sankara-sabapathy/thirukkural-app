import { getSecret } from './secrets';
import { Kural } from './email-templates';

/**
 * Sends a Thirukkural to the configured Telegram Channel.
 * Only executes if the STAGE is 'prod'.
 * Does not throw errors to prevent interrupting the daily email/push flow.
 */
export const sendToTelegramChannel = async (kural: Kural): Promise<boolean> => {
    // 1. Environment Guard
    if (process.env.STAGE !== 'prod') {
        console.log('Skipping Telegram broadcast: STAGE is not prod.');
        return false;
    }

    try {
        // 2. Fetch Secrets
        // These keys map to the PARAM_* environment variables injected by the CDK Stack
        const botToken = await getSecret('PARAM_TELEGRAM_BOT_TOKEN');
        const channelId = await getSecret('PARAM_TELEGRAM_CHANNEL_ID');

        if (!botToken || !channelId) {
            console.error('Telegram broadcast failed: Missing API Token or Channel ID from SSM.');
            return false;
        }

        // 3. Format Message
        const message = formatTelegramMessage(kural);

        // 4. Dispatch to Telegram API
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: channelId,
                text: message,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Telegram API Error: ${response.status} ${response.statusText}`, errorBody);
            return false;
        }

        console.log(`Successfully broadcasted Kural #${kural.kuralId} to Telegram Channel.`);
        return true;

    } catch (error) {
        console.error('Unexpected error during Telegram broadcast:', error);
        return false; // Fail gracefully
    }
};

/**
 * Formats a Kural into a clean, HTML-parsed Telegram message.
 */
function formatTelegramMessage(kural: Kural): string {
    const appUrl = process.env.APP_DOMAIN || 'https://thirukkural.site';
    const kuralLink = `${appUrl}/kural/${kural.kuralId}`;

    const categories = [kural.pal, kural.iyal, kural.adikaram].filter(Boolean).join(' ❯ ');

    let msg = `<b>✨ Thirukkural of the Day ✨</b>\n`;
    msg += `<b>Kural #${kural.kuralId}</b>\n\n`;

    if (categories) {
        msg += `<i>${categories}</i>\n\n`;
    }

    msg += `<b>${kural.line1}</b>\n`;
    msg += `<b>${kural.line2}</b>\n\n`;

    if (kural.transliteration) {
        msg += `<i>${kural.transliteration.replace(/\n/g, ' ')}</i>\n\n`;
    }

    msg += `<b>Explanation (விளக்கம்):</b>\n${kural.explanation}\n\n`;

    if (kural.translation) {
        msg += `<b>English Translation:</b>\n${kural.translation}\n\n`;
    }

    msg += `<a href="${kuralLink}">📖 Read Commentaries on Thirukkural.site</a>`;

    return msg;
}
