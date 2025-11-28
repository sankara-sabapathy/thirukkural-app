export const environment = {
    production: true,
    cognito: {
        userPoolId: 'ap-south-1_g6cAch9nf',
        userPoolWebClientId: '5bjct26m4mgt914kp0rmjfaad4',
        // The 'domain' field should be just the domain name without 'https://' - Amplify adds it automatically.
        domain: 'thirukkural-app-612850243659.auth.ap-south-1.amazoncognito.com',
        // 'redirectSignIn' and 'redirectSignOut' are callback URLs and must include 'https://'.
        redirectSignIn: 'https://d232e1w18ndbh2.cloudfront.net/callback',
        redirectSignOut: 'https://d232e1w18ndbh2.cloudfront.net/',
    },
    api: {
        // 'baseUrl' for API endpoints also requires the full URL including 'https://'.
        baseUrl: 'https://08wz27wkyc.execute-api.ap-south-1.amazonaws.com/prod',
        endpoints: {
            profile: '/profile'
        }
    }
};
