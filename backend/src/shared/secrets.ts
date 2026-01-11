import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssm = new SSMClient({});
const secretCache: Record<string, string> = {};

/**
 * Retrieves a secret value from environment variables or SSM Parameter Store.
 * 
 * Logic:
 * 1. Checks if the secret is available directly in `process.env[envVarName]`.
 * 2. If not, checks if a parameter path is available in `process.env[paramPathEnvVar]`.
 * 3. If path exists, fetches the value from SSM (decrypted) and caches it.
 * 
 * @param envVarName The name of the environment variable holding the value (e.g. 'BREVO_API_KEY')
 * @param paramPathEnvVar The name of the environment variable holding the SSM path (e.g. 'PARAM_BREVO_API_KEY')
 */
export const getSecret = async (paramPathEnvVar: string): Promise<string | undefined> => {
    // 1. Check if we have the parameter path configured
    const paramPath = process.env[paramPathEnvVar];
    if (!paramPath) {
        console.warn(`SSM Parameter Path not found in env: ${paramPathEnvVar} (Value: ${paramPath})`);
        return undefined;
    }

    // 2. Check cache
    if (secretCache[paramPath]) {
        return secretCache[paramPath];
    }

    // 3. Fetch from SSM
    try {
        console.log(`Fetching secret from SSM: ${paramPath}`);
        const command = new GetParameterCommand({
            Name: paramPath,
            WithDecryption: true,
        });
        const response = await ssm.send(command);
        const value = response.Parameter?.Value;

        if (value) {
            secretCache[paramPath] = value;
            return value;
        }
    } catch (error) {
        console.error(`Failed to fetch parameter ${paramPath}:`, error);
    }

    return undefined;
};
