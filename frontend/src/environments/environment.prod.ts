export const environment = {
    production: true,
    cognito: {
        userPoolId: 'ap-south-1_g6cAch9nf',
        userPoolWebClientId: '5bjct26m4mgt914kp0rmjfaad4',
        domain: 'thirukkural-app-612850243659.auth.ap-south-1.amazoncognito.com',
        redirectSignIn: 'https://thirukkural.site/callback',
        redirectSignOut: 'https://thirukkural.site/',
    },
    api: {
        baseUrl: 'https://api.thirukkural.site',
        endpoints: {
            profile: '/profile',
            sampleEmail: '/sample-email',
            subscribe: '/subscribe'
        }
    },
    vapidPublicKey: 'undefined'
};
