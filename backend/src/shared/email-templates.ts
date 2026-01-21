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

export const generateKuralEmail = (kural: Kural, isSample: boolean = false, unsubscribeLink: string = '') => {
    const {
        kuralId,
        line1,
        line2,
        translation,
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
        ? `<p style="margin-bottom: 5px; color: #95a5a6; font-size: 12px;">This is a sample email.</p>`
        : `<p style="margin-bottom: 5px; color: #95a5a6; font-size: 12px;">To unsubscribe, <a href="${unsubscribeLink}" style="color: #3498db; text-decoration: none;">click here</a>.</p>`;

    // Colors
    const primaryColor = '#e74c3c'; // Red-ish accent
    const secondaryColor = '#2c3e50'; // Dark Blue/Grey
    const lightBg = '#f8f9fa';
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
            @import url('https://fonts.googleapis.com/css2?family=Mukta+Malar:wght@400;700&family=Noto+Serif+Tamil:wght@400;700&family=Open+Sans:wght@400;600&display=swap');
            /* Fallback fonts */
            body { font-family: 'Open Sans', Helvetica, Arial, sans-serif; }
            .tamil-font { font-family: 'Mukta Malar', 'Noto Serif Tamil', sans-serif; }
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
    <body style="margin: 0; padding: 0; background-color: #f4f4f4; color: #333333;">
        <div style="max-width: 650px; margin: 0 auto; background-color: ${white}; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); margin-top: 20px; margin-bottom: 20px; font-family: 'Open Sans', Helvetica, Arial, sans-serif;">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, ${secondaryColor} 0%, #34495e 100%); padding: 30px 30px; text-align: center; color: ${white}; position: relative;">
                <a href="https://thirukkural.site" style="text-decoration: none; display: inline-block; margin-bottom: 10px;">
                    <img src="https://thirukkural.site/assets/icons/icon-192x192.png" alt="Thirukkural Daily" style="width: 48px; height: 48px; border-radius: 8px;">
                </a>
                <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px; font-family: 'Times New Roman', serif;">Thirukkural Daily</h1>
                <p style="margin: 5px 0 0; opacity: 0.9; font-size: 14px; letter-spacing: 1px; text-transform: uppercase;">
                    <a href="https://thirukkural.site" style="color: #ffffff; text-decoration: none; border-bottom: 1px dotted rgba(255,255,255,0.5);">thirukkural.site</a>
                </p>
            </div>

            <!-- Kural Section -->
            <div style="padding: 40px 10px; text-align: center; background-color: ${white};">
                
                ${(hasContent(pal) || hasContent(iyal) || hasContent(adikaram)) ? `
                <div style="margin-bottom: 25px; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8; color: #7f8c8d;">
                   ${hasContent(pal) ? `<span style="background: #f0f2f5; padding: 4px 10px; border-radius: 20px;">${pal}</span>` : ''}
                   ${hasContent(iyal) ? `<span style="background: #f0f2f5; padding: 4px 10px; border-radius: 20px;">${iyal}</span>` : ''}
                   ${hasContent(adikaram) ? `<span style="background: #f0f2f5; padding: 4px 10px; border-radius: 20px;">${adikaram}</span>` : ''}
                </div>
                ` : ''}

                <span style="display: inline-block; background-color: #fff0ef; color: ${primaryColor}; padding: 5px 12px; border-radius: 6px; font-size: 13px; font-weight: 700; margin-bottom: 20px; letter-spacing: 0.5px;">KURAL #${kuralId}</span>
                
                <a href="${kuralLink}" style="text-decoration: none; display: block; color: inherit; width: 100%;">
                    <div class="tamil-font kural-line">
                        ${line1}
                    </div>
                    <div class="tamil-font kural-line" style="margin-bottom: 20px;">
                        ${line2}
                    </div>
                </a>
            </div>

            <!-- Translation Section -->
            ${hasContent(translation) ? `
            <div style="padding: 30px 40px; background-color: ${lightBg}; border-top: 1px solid #eeeeee;">
                <h3 style="margin-top: 0; color: ${secondaryColor}; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; font-weight: 700;">English Translation</h3>
                <p style="font-size: 18px; line-height: 1.6; color: #555555; margin-bottom: 0; font-family: 'Times New Roman', serif; font-style: italic;">
                    "${translation}"
                </p>
            </div>` : ''}

            <!-- Explanations Section -->
            <div style="padding: 40px 30px;">
                <h3 style="margin-top: 0; color: ${secondaryColor}; font-size: 18px; margin-bottom: 30px; text-align: center; font-weight: 700; border-bottom: 2px solid #eee; padding-bottom: 15px;">Commentaries</h3>
                
                ${hasContent(explanation) ? `
                <div style="margin-bottom: 25px;">
                    <strong style="color: ${primaryColor}; display: block; margin-bottom: 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">General Explanation</strong>
                    <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #444;">${explanation}</p>
                </div>` : ''}

                ${hasContent(mvText) ? `
                <div style="margin-bottom: 25px; border-top: 1px dashed #eee; padding-top: 20px;">
                    <strong style="color: #2980b9; display: block; margin-bottom: 8px; font-size: 14px; font-family: 'Mukta Malar', sans-serif;">மு. வரதராசனார்</strong>
                    <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #444; font-family: 'Mukta Malar', sans-serif;">${mvText}</p>
                </div>` : ''}

                ${hasContent(mkText) ? `
                <div style="margin-bottom: 25px; border-top: 1px dashed #eee; padding-top: 20px;">
                    <strong style="color: #2980b9; display: block; margin-bottom: 8px; font-size: 14px; font-family: 'Mukta Malar', sans-serif;">கலைஞர் மு. கருணாநிதி</strong>
                    <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #444; font-family: 'Mukta Malar', sans-serif;">${mkText}</p>
                </div>` : ''}

                ${hasContent(spText) ? `
                <div style="margin-bottom: 25px; border-top: 1px dashed #eee; padding-top: 20px;">
                    <strong style="color: #2980b9; display: block; margin-bottom: 8px; font-size: 14px; font-family: 'Mukta Malar', sans-serif;">சாலமன் பாப்பையா</strong>
                    <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #444; font-family: 'Mukta Malar', sans-serif;">${spText}</p>
                </div>` : ''}

                ${hasContent(parimelaText) ? `
                <div style="margin-bottom: 25px; border-top: 1px dashed #eee; padding-top: 20px;">
                    <strong style="color: #2980b9; display: block; margin-bottom: 8px; font-size: 14px; font-family: 'Mukta Malar', sans-serif;">பரிமேலழகர்</strong>
                     <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #444; font-family: 'Mukta Malar', sans-serif;">${parimelaText}</p>
                </div>` : ''}

                ${hasContent(manikudavarText) ? `
                <div style="margin-bottom: 25px; border-top: 1px dashed #eee; padding-top: 20px;">
                    <strong style="color: #2980b9; display: block; margin-bottom: 8px; font-size: 14px; font-family: 'Mukta Malar', sans-serif;">மணக்குடவர்</strong>
                     <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #444; font-family: 'Mukta Malar', sans-serif;">${manikudavarText}</p>
                </div>` : ''}

                 ${hasContent(vMunusamiText) ? `
                <div style="margin-bottom: 25px; border-top: 1px dashed #eee; padding-top: 20px;">
                    <strong style="color: #2980b9; display: block; margin-bottom: 8px; font-size: 14px; font-family: 'Mukta Malar', sans-serif;">திருக்குறளார் வீ. முனிசாமி</strong>
                     <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #444; font-family: 'Mukta Malar', sans-serif;">${vMunusamiText}</p>
                </div>` : ''}
            </div>

            <!-- Footer -->
            <div style="background-color: ${secondaryColor}; color: #95a5a6; padding: 40px 20px; text-align: center; font-size: 13px;">
                <p style="margin-bottom: 20px; line-height: 1.5; color: #bdc3c7;">
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
