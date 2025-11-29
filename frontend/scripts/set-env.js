const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const envConfigFile = `export const environment = {
    production: true,
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
            sampleEmail: '/sample-email'
        }
    }
};
`;

const targetPath = path.join(__dirname, '../src/environments/environment.prod.ts');

fs.writeFile(targetPath, envConfigFile, function (err) {
    if (err) {
        console.log(err);
    }
    console.log(`Output generated at ${targetPath}`);
});
