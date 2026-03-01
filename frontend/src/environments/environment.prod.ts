export const environment = {
    production: true,
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
                monthly: 'plan_SI1LN1snBZRz6W',
                yearly: 'plan_SI1LNYmawMvE3P'
            },
            USD: {
                monthly: 'plan_SI1LO7ROoTjms4',
                yearly: 'plan_SI1LOePio25yJ1'
            }
        }
    },
    telegramChannelUrl: 'https://t.me/thirukkural_site',
    vapidPublicKey: '${VAPID_PUBLIC_KEY}'
};
