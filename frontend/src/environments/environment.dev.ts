export const environment = {
    production: false,
    cognito: {
        userPoolId: '${COGNITO_USER_POOL_ID}',
        userPoolWebClientId: '${COGNITO_WEB_CLIENT_ID}',
        domain: '${COGNITO_DOMAIN}',
        redirectSignIn: '${COGNITO_REDIRECT_SIGNIN}',
        redirectSignOut: '${COGNITO_REDIRECT_SIGNOUT}',
    },
    api: {
        baseUrl: '${API_BASE_URL}',
        endpoints: {
            profile: '/profile',
            sampleEmail: '/sample-email',
            subscribe: '/subscribe'
        }
    },
    razorpay: {
        keyId: '${RAZORPAY_KEY_ID}'
    },
    vapidPublicKey: '${VAPID_PUBLIC_KEY}'
};
