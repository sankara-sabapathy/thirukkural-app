import { getSecret } from './secrets';
import { Kural } from './email-templates';

/**
 * Sends a Thirukkural to the configured Telegram Channel.
 * Only executes if the STAGE is 'prod'.
 * Does not throw errors to prevent interrupting the daily email/push flow.
 */
export const sendToTelegramChannel = async (kural: Kural): Promise<boolean> => {
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
            signal: AbortSignal.timeout(8000),
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: channelId,
                text: message,
                parse_mode: 'HTML'
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
 * Helper to escape HTML characters for Telegram parse_mode='HTML'
 */
function escapeHtml(unsafe: string | undefined): string {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Formats a Kural into a clean, HTML-parsed Telegram message.
 */
function formatTelegramMessage(kural: Kural): string {
    const appUrl = process.env.APP_DOMAIN || 'https://thirukkural.site';
    const rawKuralLink = `${appUrl}/kural/${kural.kuralId}`;
    const kuralLink = escapeHtml(rawKuralLink);

    // Get the preferred Tamil explanation (Mu. Karunanidhi or Mu. Varadarajan)
    const tamilExplanation = escapeHtml(kural.mk || kural.mv || 'விளக்கம் கிடைக்கவில்லை.');

    let msg = `✨ <b>Thirukkural of the Day</b> ✨\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    msg += `<b>குறள் ${kural.kuralId}</b>\n\n`;

    if (kural.pal) {
        msg += `📕 <b>${escapeHtml(kural.pal)}</b> (${escapeHtml(kural.pal_tl)}) — <i>${escapeHtml(kural.pal_tr)}</i>\n`;
    }
    if (kural.iyal) {
        msg += `📗 <b>${escapeHtml(kural.iyal)}</b> (${escapeHtml(kural.iyal_tl)}) — <i>${escapeHtml(kural.iyal_tr)}</i>\n`;
    }
    if (kural.adikaram) {
        msg += `📘 <b>${escapeHtml(kural.adikaram)}</b> (${escapeHtml(kural.adikaram_tl)}) — <i>${escapeHtml(kural.adikaram_tr)}</i>\n`;
    }

    if (kural.pal || kural.iyal || kural.adikaram) {
        msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    }

    // Tamil Couplet
    msg += `<b>${escapeHtml(kural.line1)}</b>\n`;
    msg += `<b>${escapeHtml(kural.line2)}</b>\n\n`;

    // Transliteration
    if (kural.transliteration) {
        msg += `<i>${escapeHtml(kural.transliteration.replace(/\n/g, '\n'))}</i>\n\n`;
    }

    // Tamil Explanation
    msg += `💡 <b>தமிழ் விளக்கம்:</b>\n${tamilExplanation}\n\n`;

    // English Meaning
    msg += `🌍 <b>English Meaning:</b>\n`;
    if (kural.explanation) {
        msg += `${escapeHtml(kural.explanation)}\n`;
    }
    if (kural.translation) {
        msg += `<i>"${escapeHtml(kural.translation)}"</i>\n\n`;
    } else {
        msg += `\n`;
    }

    msg += `<a href="${kuralLink}">📖 Read all commentaries on Thirukkural.site</a>`;

    return msg;
}
