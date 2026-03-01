export const environment = {
    production: false,
    enablePayments: true,
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
        keyId: '${RAZORPAY_KEY_ID}',
        plans: {
            INR: {
                monthly: 'plan_SCB8cdaYV5UXEP', // Test Monthly INR
                yearly: 'plan_SCB8dBVUs1Jmmw' // Test Yearly INR
            },
            USD: {
                monthly: 'plan_SI3YOmJ7D1tH5g',
                yearly: 'plan_SI3YOpTWnhtNiK'
            }
        }
    },
    telegramChannelUrl: 'https://t.me/thirukkural_site_dev',
    vapidPublicKey: '${VAPID_PUBLIC_KEY}'
};
