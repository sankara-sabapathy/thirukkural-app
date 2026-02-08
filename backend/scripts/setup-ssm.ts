import { SSMClient, PutParameterCommand, GetParameterCommand } from '@aws-sdk/client-ssm';

const client = new SSMClient({ region: process.env.AWS_REGION || 'ap-south-1' });

async function putParam(name: string, value: string, type: 'String' | 'SecureString', overwrite = true) {
    try {
        // Safety check for Secrets: Don't overwrite existing secrets with placeholders
        if (type === 'SecureString' && value === 'CHANGE_ME') {
            try {
                await client.send(new GetParameterCommand({ Name: name }));
                console.log(`[SKIP] Secret ${name} already exists. Skipping placeholder overwrite.`);
                return;
            } catch (e: any) {
                // If not found, proceed to create placeholder
                if (e.name !== 'ParameterNotFound') throw e;
            }
        }

        await client.send(new PutParameterCommand({
            Name: name,
            Value: value,
            Type: type,
            Overwrite: overwrite
        }));
        console.log(`[OK] Set ${name}`);
    } catch (error) {
        console.error(`[ERROR] Failed to set ${name}:`, error);
        process.exit(1);
    }
}

if (!process.env.STAGE) {
    console.error('[ERROR] STAGE environment variable is required (e.g. dev, prod, uat).');
    process.exit(1);
}
const STAGE = process.env.STAGE;
console.log(`Setting up SSM parameters for stage: ${STAGE}`);

const CONFIG: StringMap = {
    common: {
        base_domain: 'YOUR_DOMAIN.com',
        email_provider: 'SES',
        vapid_subject: 'mailto:admin@YOUR_DOMAIN.com',
        vapid_public_key: 'YOUR_VAPID_PUBLIC_KEY',
        google_client_id: 'YOUR_GOOGLE_CLIENT_ID',
        google_client_secret: 'YOUR_GOOGLE_CLIENT_SECRET', // Changed to String from SecureString for CloudFormation compatibility
    },
    // Stage-specific overrides/values
    stages: {
        dev: {
            email_sender_name: 'Thirukkural Daily (Dev)',
            email_sender_address: 'dev-noreply@YOUR_DOMAIN.com',
            email_reply_to: 'dev-support@YOUR_DOMAIN.com',
            // Placeholder ARNs
            acm_certificate_arn_api: 'arn:aws:acm:us-east-1:YOUR_ACCOUNT_ID:certificate/YOUR_WILDCARD_OR_DEV_CERT_ID',
            acm_certificate_arn_cloudfront: 'arn:aws:acm:us-east-1:YOUR_ACCOUNT_ID:certificate/YOUR_WILDCARD_OR_DEV_CERT_ID',
        },
        prod: {
            email_sender_name: 'Thirukkural Daily',
            email_sender_address: 'noreply@YOUR_DOMAIN.com',
            email_reply_to: 'support@YOUR_DOMAIN.com',
            // Placeholder ARNs
            acm_certificate_arn_api: 'arn:aws:acm:us-east-1:YOUR_ACCOUNT_ID:certificate/YOUR_PROD_CERT_ID',
            acm_certificate_arn_cloudfront: 'arn:aws:acm:us-east-1:YOUR_ACCOUNT_ID:certificate/YOUR_PROD_CERT_ID',
        }
    } as Record<string, Record<string, string>>,
    secrets: [
        'vapid_private_key',
        'cloudflare_secret_key',
        'unsubscribe_secret',
        'brevo_api_key',
        'razorpay_key_id',
        'razorpay_key_secret',
        'razorpay_webhook_secret',
    ]
};

// ... putParam function ...

async function main() {
    console.log(`Starting SSM Parameter Setup for ${STAGE}...`);

    // Get config for this stage, defaulting to empty if not found (or fail if critical?)
    // For a new stage like 'uat', if no specific config exists, maybe we just use common + secrets?
    // Or we can say 'dev' config serves as a template?
    // Let's assume strict config for now or fallback to empty.
    const stageConfig = CONFIG.stages[STAGE];
    if (!stageConfig) {
        console.warn(`[WARN] No specific configuration found for stage '${STAGE}'. Only common parameters will be set.`);
    }

    // 1. Common Vars
    for (const [key, value] of Object.entries(CONFIG.common)) {
        await putParam(`/${STAGE}/thirukkural/${key}`, value as string, 'String');
    }

    // 2. Stage-Specific Vars
    if (stageConfig) {
        for (const [key, value] of Object.entries(stageConfig)) {
            await putParam(`/${STAGE}/thirukkural/${key}`, value, 'String');
        }
    }

    // 3. Secrets
    for (const key of CONFIG.secrets) {
        await putParam(`/${STAGE}/thirukkural/${key}`, 'CHANGE_ME', 'SecureString');
    }

    console.log('SSM Parameter Setup Complete.');
    console.log('IMPORTANT: Please manually update any "CHANGE_ME" values and ARNs in AWS Systems Manager Parameter Store.');
}

main();

// Helper Types
interface StringMap {
    common: Record<string, string>;
    stages: Record<string, Record<string, string>>;
    secrets: string[];
}
