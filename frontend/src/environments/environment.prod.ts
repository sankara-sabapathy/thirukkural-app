export const environment = {
    production: true,
    cognito: {
        userPoolId: 'YOUR_PROD_USER_POOL_ID',
        userPoolWebClientId: 'YOUR_PROD_USER_POOL_CLIENT_ID',
        domain: 'YOUR_PROD_COGNITO_DOMAIN_PREFIX.auth.us-east-1.amazoncognito.com',
        redirectSignIn: 'https://your-domain.com/callback',
        redirectSignOut: 'https://your-domain.com/',
    },
    api: {
        baseUrl: 'YOUR_PROD_API_GATEWAY_URL',
        endpoints: {
            profile: '/profile',
            subscribe: '/subscribe',
            unsubscribe: '/unsubscribe'
        }
    }
};
