export const environment = {
    production: false,
    cognito: {
        userPoolId: 'us-east-1_XXXXX',
        userPoolWebClientId: 'xxxxxxxxxxxxxx',
        domain: 'thirukkural-app.auth.us-east-1.amazoncognito.com',
        redirectSignIn: 'http://localhost:4200/',
        redirectSignOut: 'http://localhost:4200/',
    },
    api: {
        subscribeUrl: 'https://xxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/subscribe',
        unsubscribeUrl: 'https://xxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/unsubscribe',
    }
};
