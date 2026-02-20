export const environment = {
    production: false,
    enablePayments: false,
    cognito: {
        userPoolId: 'ap-south-1_g6cAch9nf',
        userPoolWebClientId: '5bjct26m4mgt914kp0rmjfaad4',
        domain: 'thirukkural-app-612850243659.auth.ap-south-1.amazoncognito.com',
        redirectSignIn: 'https://thirukkural.krss.online/callback',
        redirectSignOut: 'https://thirukkural.krss.online/',
    },
    api: {
        baseUrl: 'https://api.krss.online',
        endpoints: {
            profile: '/profile',
            sampleEmail: '/sample-email',
            subscribe: '/subscribe'
        }
    },
    razorpay: {
        keyId: 'rzp_test_SC6SfzckFW4xe0',
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
    vapidPublicKey: undefined
};
