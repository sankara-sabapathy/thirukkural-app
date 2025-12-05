
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({});

export interface EmailOptions {
    to: string[];
    subject: string;
    text: string;
    html: string;
    replyTo?: string;
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
    const provider = process.env.EMAIL_PROVIDER || 'SES';

    console.log(`Sending email using provider: ${provider}`);

    if (provider === 'BREVO') {
        const apiKey = process.env.BREVO_API_KEY;
        const senderName = process.env.EMAIL_SENDER_NAME || 'Thirukkural Daily';
        const senderEmail = process.env.EMAIL_SENDER_ADDRESS || 'noreply@example.com';
        const replyToEmail = options.replyTo || process.env.EMAIL_REPLY_TO || 'noreply@example.com';

        if (!apiKey) {
            throw new Error('BREVO_API_KEY is not configured');
        }

        const url = 'https://api.brevo.com/v3/smtp/email';
        const data = {
            sender: {
                name: senderName,
                email: senderEmail
            },
            replyTo: {
                email: replyToEmail
            },
            to: options.to.map(email => ({ email })),
            subject: options.subject,
            htmlContent: options.html,
            textContent: options.text
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        console.log(`Brevo API Response Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Brevo API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        console.log('Email sent successfully via Brevo');
    } else {
        // Default to SES
        // Default to SES
        const senderEmail = process.env.SES_SENDER || process.env.EMAIL_SENDER_ADDRESS || 'noreply@example.com';
        const replyToEmail = options.replyTo || process.env.EMAIL_REPLY_TO || 'noreply@example.com';

        const sendCmd = new SendEmailCommand({
            Destination: { ToAddresses: options.to },
            Message: {
                Body: {
                    Text: { Data: options.text },
                    Html: { Data: options.html }
                },
                Subject: { Data: options.subject },
            },
            Source: senderEmail, // SES requires a verified sender identity
            ReplyToAddresses: [replyToEmail],
        });

        await ses.send(sendCmd);
        console.log('Email sent successfully via SES');
    }
};
