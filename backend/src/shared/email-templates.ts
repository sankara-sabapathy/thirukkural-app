export interface Kural {
    kuralId: number;
    line1: string;
    line2: string;
    translation: string;
    explanation?: string;
    couplet?: string;
    transliteration?: string;
    mk?: string; // Mu. Karunanidhi
    mv?: string; // M. Varadarajan
    sp?: string; // Solomon Pappaiah
    // New fields
    pal?: string;
    iyal?: string;
    adikaram?: string;
    parimela?: string[]; // Parimelazhagar [Title, content]
    manikudavar?: string[]; // Manakkudavar [Title, content]
    v_munusami?: string[]; // V. Munusami [Title, content]
    mu_varatha?: string[]; // Mu. Varadarajan Array format [Title, content]
    mu_karu?: string[]; // Mu. Karunanidhi Array format [Title, content]
    salaman?: string[]; // Solomon Pappaiah Array format [Title, content]
}

export const generateKuralEmail = (kural: Kural, isSample: boolean = false, unsubscribeLink: string = '', iconUrl: string = 'https://thirukkural.site/assets/icons/icon-192x192.png') => {
    const {
        kuralId,
        line1,
        line2,
        translation,
        transliteration,
        explanation = '',
        pal = '',
        iyal = '',
        adikaram = '',
        mv,
        mk,
        sp,
        parimela,
        manikudavar,
        v_munusami,
        mu_varatha,
        mu_karu,
        salaman
    } = kural;

    // Normalizing data from different possible formats
    const mvText = mv || (mu_varatha && mu_varatha[1]) || '';
    const mkText = mk || (mu_karu && mu_karu[1]) || '';
    const spText = sp || (salaman && salaman[1]) || '';
    // Helper to extract text from array format [Title, Content, ...MoreContent]
    const getCommentary = (arr?: string[]) => {
        if (!arr || !Array.isArray(arr) || arr.length < 2) return '';
        return arr.slice(1).join('<br/><br/>');
    };

    const parimelaText = getCommentary(parimela);
    const manikudavarText = getCommentary(manikudavar);
    const vMunusamiText = getCommentary(v_munusami);

    const subject = `Thirukkural #${kuralId}: ${translation.substring(0, 50)}...`;

    const kuralLink = `https://thirukkural.site/kural/${kuralId}`;

    // Unsubscribe text logic
    const unsubscribeText = isSample
        ? "This is a one-time sample email. You are not subscribed."
        : 'To unsubscribe, click the link below.';

    const footerText = isSample
        ? "You received this sample email because you requested it on our website."
        : "You are receiving this email because you subscribed to Thirukkural Daily.";

    const unsubscribeHtml = isSample
        ? `<p style="margin-bottom: 5px; color: #94a3b8; font-size: 12px;">This is a sample email.</p>`
        : `<p style="margin-bottom: 5px; color: #94a3b8; font-size: 12px;">To unsubscribe, <a href="${unsubscribeLink}" style="color: #2563eb; text-decoration: none;">click here</a>.</p>`;

    // Colors
    const primaryColor = '#1868db'; // Exact Blue
    const secondaryColor = '#1e293b'; // Slate 800 (Dark Slate Blue, not black)
    const lightBg = '#f8fafc';
    const white = '#ffffff';

    // Helper to check if string has content
    const hasContent = (str: string | undefined | null) => str && str.trim().length > 0;

    const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Thirukkural Daily</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Noto+Sans+Tamil:wght@400;600;700&display=swap');
            /* Fallback fonts */
            body { font-family: 'Inter', Helvetica, Arial, sans-serif; }
            .tamil-font { font-family: 'Noto Sans Tamil', sans-serif; }
            .kural-line {
                display: block;
                font-size: 20px;
                font-weight: bold;
                line-height: 1.6;
                color: ${secondaryColor};
                margin-bottom: 8px;
            }
        </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; color: #334155;">
        <div style="max-width: 650px; margin: 0 auto; background-color: ${white}; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); margin-top: 20px; margin-bottom: 20px; font-family: 'Inter', Helvetica, Arial, sans-serif;">
            
            <!-- Header -->
            <div style="background-color: ${primaryColor}; padding: 30px 30px; text-align: center; color: ${white}; position: relative;">
                <a href="https://thirukkural.site" style="text-decoration: none; display: inline-block; margin-bottom: 10px;">
                    <img src="${iconUrl}" alt="Thirukkural Daily" style="width: 48px; height: 48px; border-radius: 8px;">
                </a>
                <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px; font-family: 'Inter', sans-serif;">Thirukkural Daily</h1>
                <p style="margin: 5px 0 0; opacity: 0.9; font-size: 14px; letter-spacing: 1px; text-transform: uppercase;">
                    <a href="https://thirukkural.site" style="color: #ffffff; text-decoration: none; border-bottom: 1px dotted rgba(255,255,255,0.5);">thirukkural.site</a>
                </p>
            </div>

            <!-- Kural Section -->
            <div style="padding: 40px 10px; text-align: center; background-color: ${white};">
                
                ${(hasContent(pal) || hasContent(iyal) || hasContent(adikaram)) ? `
                <div style="margin-bottom: 25px; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8; color: #64748b;">
                   ${hasContent(pal) ? `<span style="background: #f1f5f9; padding: 4px 10px; border-radius: 20px;">${pal}</span>` : ''}
                   ${hasContent(iyal) ? `<span style="background: #f1f5f9; padding: 4px 10px; border-radius: 20px;">${iyal}</span>` : ''}
                   ${hasContent(adikaram) ? `<span style="background: #f1f5f9; padding: 4px 10px; border-radius: 20px;">${adikaram}</span>` : ''}
                </div>
                ` : ''}

                <span style="display: inline-block; background-color: #eff6ff; color: ${primaryColor}; padding: 5px 12px; border-radius: 6px; font-size: 13px; font-weight: 700; margin-bottom: 20px; letter-spacing: 0.5px;">KURAL #${kuralId}</span>
                
                <a href="${kuralLink}" style="text-decoration: none; display: block; color: inherit; width: 100%;">
                    <div class="tamil-font kural-line">
                        ${line1}
                    </div>
                    <div class="tamil-font kural-line" style="margin-bottom: 20px;">
                        ${line2}
                    </div>
                </a>

                ${hasContent(transliteration) ? `
                <div style="margin-top: 15px; color: #64748b; font-style: italic; font-size: 14px; line-height: 1.6;">
                     ${transliteration?.replace(/\n/g, '<br/>')}
                </div>
                ` : ''}
            </div>

            <!-- English Meaning Section -->
            ${(hasContent(translation) || hasContent(explanation)) ? `
            <div style="padding: 30px 40px; background-color: ${lightBg}; border-top: 1px solid #e2e8f0;">
                <h3 style="margin-top: 0; color: ${secondaryColor}; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px; font-weight: 700;">English Meaning</h3>
                
                ${hasContent(translation) ? `
                <div style="margin-bottom: 20px;">
                    <strong style="display: block; margin-bottom: 8px; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Translation</strong>
                    <p style="font-size: 15px; line-height: 1.6; color: ${secondaryColor}; margin: 0; font-family: 'Inter', serif; font-style: italic;">
                        "${translation}"
                    </p>
                </div>
                ` : ''}

                ${hasContent(explanation) ? `
                <div style="${hasContent(translation) ? 'border-top: 1px dashed #cbd5e1; padding-top: 20px;' : ''}">
                    <strong style="display: block; margin-bottom: 8px; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Explanation</strong>
                    <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #334155;">${explanation}</p>
                </div>
                ` : ''}
            </div>` : ''}

            <!-- Tamil Commentaries Section -->
            <div style="padding: 40px 30px;">
                <h3 style="margin-top: 0; color: ${secondaryColor}; font-size: 18px; margin-bottom: 30px; text-align: center; font-weight: 700; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px;">Tamil Commentaries</h3>
                
                ${hasContent(mvText) ? `
                <div style="margin-bottom: 25px;">
                    <strong style="color: ${primaryColor}; display: block; margin-bottom: 8px; font-size: 14px; font-family: 'Noto Sans Tamil', sans-serif;">மு. வரதராசனார்</strong>
                    <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #334155; font-family: 'Noto Sans Tamil', sans-serif;">${mvText}</p>
                </div>` : ''}

                ${hasContent(mkText) ? `
                <div style="margin-bottom: 25px; border-top: 1px dashed #e2e8f0; padding-top: 20px;">
                    <strong style="color: ${primaryColor}; display: block; margin-bottom: 8px; font-size: 14px; font-family: 'Noto Sans Tamil', sans-serif;">கலைஞர் மு. கருணாநிதி</strong>
                    <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #334155; font-family: 'Noto Sans Tamil', sans-serif;">${mkText}</p>
                </div>` : ''}

                ${hasContent(spText) ? `
                <div style="margin-bottom: 25px; border-top: 1px dashed #e2e8f0; padding-top: 20px;">
                    <strong style="color: ${primaryColor}; display: block; margin-bottom: 8px; font-size: 14px; font-family: 'Noto Sans Tamil', sans-serif;">சாலமன் பாப்பையா</strong>
                    <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #334155; font-family: 'Noto Sans Tamil', sans-serif;">${spText}</p>
                </div>` : ''}

                ${hasContent(parimelaText) ? `
                <div style="margin-bottom: 25px; border-top: 1px dashed #e2e8f0; padding-top: 20px;">
                    <strong style="color: ${primaryColor}; display: block; margin-bottom: 8px; font-size: 14px; font-family: 'Noto Sans Tamil', sans-serif;">பரிமேலழகர்</strong>
                     <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #334155; font-family: 'Noto Sans Tamil', sans-serif;">${parimelaText}</p>
                </div>` : ''}

                ${hasContent(manikudavarText) ? `
                <div style="margin-bottom: 25px; border-top: 1px dashed #e2e8f0; padding-top: 20px;">
                    <strong style="color: ${primaryColor}; display: block; margin-bottom: 8px; font-size: 14px; font-family: 'Noto Sans Tamil', sans-serif;">மணக்குடவர்</strong>
                     <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #334155; font-family: 'Noto Sans Tamil', sans-serif;">${manikudavarText}</p>
                </div>` : ''}

                 ${hasContent(vMunusamiText) ? `
                <div style="margin-bottom: 25px; border-top: 1px dashed #e2e8f0; padding-top: 20px;">
                    <strong style="color: ${primaryColor}; display: block; margin-bottom: 8px; font-size: 14px; font-family: 'Noto Sans Tamil', sans-serif;">திருக்குறளார் வீ. முனிசாமி</strong>
                     <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #334155; font-family: 'Noto Sans Tamil', sans-serif;">${vMunusamiText}</p>
                </div>` : ''}
            </div>

            <!-- Footer -->
            <div style="background-color: ${lightBg}; color: #64748b; padding: 40px 20px; text-align: center; font-size: 13px; border-top: 1px solid #e2e8f0;">
                <p style="margin-bottom: 20px; line-height: 1.5; color: #64748b;">
                    ${footerText}
                </p>
                ${unsubscribeHtml}
                <p style="margin: 20px 0 0; opacity: 0.6; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
                    &copy; ${new Date().getFullYear()} KRSS Online. All rights reserved.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    return { subject, text: `Thirukkural Daily #${kuralId}\n\n${line1}\n${line2}\n\nTranslation: ${translation}\n\n${kuralLink}\n\n${unsubscribeText}\n${isSample ? '' : unsubscribeLink}`, html: htmlBody };
};

export interface SystemEmailOptions {
    type: 'WELCOME_PLUS' | 'CREDITS_ADDED' | 'LOW_CREDITS' | 'PAYMENT_FAILED';
    data?: any; // e.g. amount of credits, etc.
}

export const generateSystemEmail = (options: SystemEmailOptions) => {
    let subject = '';
    let headline = '';
    let message = '';

    // Colors
    const primaryColor = '#1868db';
    const white = '#ffffff';

    switch (options.type) {
        case 'WELCOME_PLUS':
            subject = 'Welcome to Thirukkural Plus!';
            headline = 'Subscription Active';
            message = 'Thank you for subscribing to **Thirukkural Plus**. You now have unlimited access to daily emails.';
            break;
        case 'CREDITS_ADDED':
            subject = 'Credits Added Successfully';
            headline = 'Credits Added';
            message = `You have successfully added **${options.data?.credits} credits** to your account.`;
            break;
        case 'LOW_CREDITS':
            subject = 'Low Credit Warning';
            headline = 'Running Low on Credits';
            message = `You have **${options.data?.credits} credits** remaining. Please top up to continue receiving daily emails without interruption.`;
            break;
        case 'PAYMENT_FAILED':
            subject = 'Payment Failed';
            headline = 'Action Required';
            message = 'We were unable to process your subscription renewal. Please update your payment method to maintain access.';
            break;
    }

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
             body { font-family: 'Inter', Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f1f5f9; color: #334155; }
        </style>
    </head>
    <body>
        <div style="max-width: 600px; margin: 20px auto; background-color: ${white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="background-color: ${primaryColor}; padding: 20px; text-align: center; color: ${white};">
                <h1 style="margin: 0; font-size: 20px;">Thirukkural Daily</h1>
            </div>
            <div style="padding: 30px;">
                <h2 style="color: #1e293b; margin-top: 0;">${headline}</h2>
                <p style="font-size: 16px; line-height: 1.6; color: #475569;">
                    ${message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
                </p>
                <div style="margin-top: 30px; text-align: center;">
                    <a href="https://thirukkural.site/profile" style="background-color: ${primaryColor}; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">Go to Dashboard</a>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    return { subject, text: message.replace(/\*\*(.*?)\*\*/g, '$1'), html };
};
