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
                monthly: 'plan_monthly_inr', // Placeholder
                yearly: 'plan_yearly_inr'   // Placeholder
            },
            USD: {
                monthly: 'plan_monthly_usd', // Placeholder
                yearly: 'plan_yearly_usd'   // Placeholder
            }
        }
    },
    vapidPublicKey: '${VAPID_PUBLIC_KEY}'
};
