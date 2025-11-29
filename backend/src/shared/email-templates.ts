export interface Kural {
    kuralId: number;
    line1: string;
    line2: string;
    translation?: string;
    explanation?: string;
    couplet?: string;
    transliteration?: string;
    mk?: string;
    mv?: string;
    sp?: string;
}

export const generateKuralEmail = (kural: Kural, isSample: boolean = false) => {
    const { kuralId, line1, line2, translation = '', explanation = '', couplet = '', transliteration = '', mk = '', mv = '', sp = '' } = kural;

    const subject = `Thirukkural #${kuralId}: ${translation.substring(0, 50)}...`;

    const unsubscribeText = isSample
        ? "This is a one-time sample email. You are not subscribed."
        : 'To unsubscribe, reply "unsubscribe" or login to thirukkural.krss.online.';

    const footerText = isSample
        ? "You received this sample email because you requested it on our website."
        : "You are receiving this email because you subscribed to Thirukkural Daily.";

    const unsubscribeHtml = isSample
        ? `<p style="margin-bottom: 15px; color: #bdc3c7;">This is a sample email. No further emails will be sent unless you subscribe.</p>`
        : `<p style="margin-bottom: 15px; color: #bdc3c7;">To unsubscribe, please reply to this email with "unsubscribe" (processing may take 48-72 hours) or <a href="https://thirukkural.krss.online" style="color: #3498db; text-decoration: none;">login to your account</a> to unsubscribe instantly.</p>`;

    const textBody = `Thirukkural Daily #${kuralId}\n\n${line1}\n${line2}\n\nTranslation: ${translation}\n\nExplanation: ${explanation}\n\n${unsubscribeText}`;

    const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Thirukkural Daily</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; color: #333333;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-top: 20px; margin-bottom: 20px;">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%); padding: 30px 20px; text-align: center; color: #ffffff;">
                <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px;">Thirukkural Daily</h1>
                <p style="margin: 10px 0 0; opacity: 0.9; font-size: 16px;">Wisdom for your inbox</p>
            </div>

            <!-- Kural Section -->
            <div style="padding: 40px 30px; text-align: center; background-color: #ffffff;">
                <span style="display: inline-block; background-color: #f0f7fa; color: #3498db; padding: 5px 15px; border-radius: 20px; font-size: 14px; font-weight: 600; margin-bottom: 20px;">Kural #${kuralId}</span>
                
                <div style="font-size: 22px; font-weight: bold; line-height: 1.6; color: #2c3e50; margin-bottom: 15px; font-family: 'Mukta Malar', sans-serif;">
                    ${line1}<br>${line2}
                </div>
                
                ${transliteration ? `<p style="color: #7f8c8d; font-style: italic; margin-bottom: 0;">${transliteration}</p>` : ''}
            </div>

            <!-- Translation Section -->
            <div style="padding: 30px; background-color: #f8f9fa; border-top: 1px solid #eeeeee; border-bottom: 1px solid #eeeeee;">
                <h3 style="margin-top: 0; color: #34495e; font-size: 18px; border-left: 4px solid #3498db; padding-left: 10px;">Translation</h3>
                <p style="font-size: 16px; line-height: 1.6; color: #555555; margin-bottom: 0;">
                    "${translation}"
                </p>
            </div>

            <!-- Explanations Section -->
            <div style="padding: 30px;">
                <h3 style="margin-top: 0; color: #34495e; font-size: 18px; border-left: 4px solid #2ecc71; padding-left: 10px;">Explanations</h3>
                
                ${explanation ? `
                <div style="margin-bottom: 20px;">
                    <strong style="color: #2c3e50; display: block; margin-bottom: 5px;">General Explanation</strong>
                    <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #666666;">${explanation}</p>
                </div>` : ''}

                ${mv ? `
                <div style="margin-bottom: 20px;">
                    <strong style="color: #2c3e50; display: block; margin-bottom: 5px;">M. Varadarajan</strong>
                    <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #666666;">${mv}</p>
                </div>` : ''}

                ${mk ? `
                <div style="margin-bottom: 20px;">
                    <strong style="color: #2c3e50; display: block; margin-bottom: 5px;">Mu. Karunanidhi</strong>
                    <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #666666;">${mk}</p>
                </div>` : ''}

                ${sp ? `
                <div style="margin-bottom: 20px;">
                    <strong style="color: #2c3e50; display: block; margin-bottom: 5px;">Solomon Pappaiah</strong>
                    <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #666666;">${sp}</p>
                </div>` : ''}
            </div>

            <!-- Footer -->
            <div style="background-color: #2c3e50; color: #ecf0f1; padding: 30px 20px; text-align: center; font-size: 13px;">
                <p style="margin-bottom: 15px;">
                    ${footerText}
                </p>
                ${unsubscribeHtml}
                <p style="margin: 0; opacity: 0.6;">
                    &copy; ${new Date().getFullYear()} KRSS Online. All rights reserved.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    return { subject, text: textBody, html: htmlBody };
};
