export const environment = {
    production: true,
    cognito: {
        userPoolId: 'ap-south-1_g6cAch9nf',
        userPoolWebClientId: '5bjct26m4mgt914kp0rmjfaad4',
        domain: 'https://thirukkural-app-612850243659.auth.ap-south-1.amazoncognito.com',
        redirectSignIn: 'https://d232e1w18ndbh2.cloudfront.net/callback',
        redirectSignOut: 'https://d232e1w18ndbh2.cloudfront.net/',
    },
    api: {
        baseUrl: 'https://08wz27wkyc.execute-api.ap-south-1.amazonaws.com/prod/',
        endpoints: {
            profile: '/profile',
            subscribe: '/subscribe',
            unsubscribe: '/unsubscribe'
        }
    }
};
