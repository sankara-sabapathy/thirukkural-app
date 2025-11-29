export const environment = {
    production: true,
    cognito: {
        userPoolId: 'PLACEHOLDER_USER_POOL_ID',
        userPoolWebClientId: 'PLACEHOLDER_WEB_CLIENT_ID',
        domain: 'PLACEHOLDER_COGNITO_DOMAIN',
        redirectSignIn: 'PLACEHOLDER_REDIRECT_SIGNIN',
        redirectSignOut: 'PLACEHOLDER_REDIRECT_SIGNOUT',
    },
    api: {
        baseUrl: 'PLACEHOLDER_API_BASE_URL',
        endpoints: {
            profile: '/profile',
            sampleEmail: '/sample-email'
        }
    }
};
