export const environment = {
    production: false,
    cognito: {
        userPoolId: 'YOUR_USER_POOL_ID',
        userPoolWebClientId: 'YOUR_USER_POOL_CLIENT_ID',
        domain: 'YOUR_COGNITO_DOMAIN_PREFIX.auth.us-east-1.amazoncognito.com',
        redirectSignIn: 'http://localhost:4200/callback',
        redirectSignOut: 'http://localhost:4200/',
    },
    api: {
        baseUrl: 'YOUR_API_GATEWAY_URL', // e.g., https://xyz.execute-api.us-east-1.amazonaws.com/prod
        endpoints: {
            profile: '/profile',
            // subscribe/unsubscribe are now handled via profile preferences, 
            // but if you kept the old endpoints for public access:
            subscribe: '/subscribe',
            unsubscribe: '/unsubscribe'
        }
    }
};
