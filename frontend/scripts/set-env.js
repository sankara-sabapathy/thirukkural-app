const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Default to prod, but allow override via arg
const isDev = process.argv.includes('--dev');
const targetFile = isDev ? 'environment.dev.ts' : 'environment.prod.ts';
const targetPath = path.join(__dirname, `../src/environments/environment.${isDev ? 'dev' : 'prod'}.ts`);

const envConfigFile = `export const environment = {
    production: ${!isDev},
    cognito: {
        userPoolId: '${process.env.COGNITO_USER_POOL_ID}',
        userPoolWebClientId: '${process.env.COGNITO_WEB_CLIENT_ID}',
        domain: '${process.env.COGNITO_DOMAIN}',
        redirectSignIn: '${process.env.COGNITO_REDIRECT_SIGNIN}',
        redirectSignOut: '${process.env.COGNITO_REDIRECT_SIGNOUT}',
    },
    api: {
        baseUrl: '${process.env.API_BASE_URL}',
        endpoints: {
            profile: '/profile',
            sampleEmail: '/sample-email',
            subscribe: '/subscribe'
        }
    },
    vapidPublicKey: '${process.env.VAPID_PUBLIC_KEY}'
};
`;

console.log(`Generating ${targetFile} ...`);
fs.writeFile(targetPath, envConfigFile, function (err) {
    if (err) {
        console.log(err);
    }
    console.log(`Output generated at ${targetPath}`);
});
