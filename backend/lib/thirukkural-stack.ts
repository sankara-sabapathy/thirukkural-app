import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export class ThirukkuralStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // DynamoDB tables
        const kuralTable = new dynamodb.Table(this, 'ThirukkuralTable', {
            partitionKey: { name: 'kuralId', type: dynamodb.AttributeType.NUMBER },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN, // Enterprise: Retain data
        });

        const subscriberTable = new dynamodb.Table(this, 'SubscribersTable', {
            partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN, // Enterprise: Retain data
        });

        // Cognito User Pool with Google IdP
        const userPool = new cognito.UserPool(this, 'UserPool', {
            selfSignUpEnabled: true,
            signInAliases: { email: true },
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true,
            },
        });

        const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
            userPool,
            generateSecret: false,
            oAuth: {
                flows: {
                    authorizationCodeGrant: true,
                },
                scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE, cognito.OAuthScope.OPENID],
                callbackUrls: ['http://localhost:4200/'], // Placeholder, update for prod
                logoutUrls: ['http://localhost:4200/'],
            }
        });

        // Placeholder for Google Client ID/Secret
        // In a real enterprise setup, these should be in Secrets Manager or SSM Parameter Store
        const googleClientId = process.env.GOOGLE_CLIENT_ID || 'PLACEHOLDER_CLIENT_ID';
        const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || 'PLACEHOLDER_CLIENT_SECRET';

        if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
            const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleIdP', {
                clientId: googleClientId,
                clientSecret: googleClientSecret,
                userPool,
                scopes: ['profile', 'email', 'openid'],
                attributeMapping: {
                    email: cognito.ProviderAttribute.GOOGLE_EMAIL,
                    givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
                    familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
                    profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
                },
            });
            userPool.registerIdentityProvider(googleProvider);
        }

        const userPoolDomain = userPool.addDomain('UserPoolDomain', {
            cognitoDomain: {
                domainPrefix: 'thirukkural-app-' + this.account, // Unique domain
            },
        });

        // Lambda functions
        const commonEnv = {
            KURAL_TABLE: kuralTable.tableName,
            SUBSCRIBER_TABLE: subscriberTable.tableName,
            SES_SENDER: process.env.SES_SENDER_EMAIL ?? 'noreply@example.com',
        };

        const nodeJsProps: nodejs.NodejsFunctionProps = {
            runtime: lambda.Runtime.NODEJS_20_X,
            environment: commonEnv,
            bundling: {
                minify: true,
                sourceMap: true,
            },
        };

        const subscribeFn = new nodejs.NodejsFunction(this, 'SubscribeFn', {
            entry: path.join(__dirname, '../../src/handlers/subscribe.ts'),
            ...nodeJsProps,
        });

        const unsubscribeFn = new nodejs.NodejsFunction(this, 'UnsubscribeFn', {
            entry: path.join(__dirname, '../../src/handlers/unsubscribe.ts'),
            ...nodeJsProps,
        });

        const sendEmailFn = new nodejs.NodejsFunction(this, 'SendDailyEmailFn', {
            entry: path.join(__dirname, '../../src/handlers/send-daily-email.ts'),
            timeout: cdk.Duration.minutes(5), // Allow more time for sending emails
            ...nodeJsProps,
        });

        // Permissions
        kuralTable.grantReadData(sendEmailFn);
        subscriberTable.grantReadWriteData(subscribeFn);
        subscriberTable.grantReadWriteData(unsubscribeFn);
        subscriberTable.grantReadData(sendEmailFn);

        sendEmailFn.addToRolePolicy(new iam.PolicyStatement({
            actions: ['ses:SendEmail', 'ses:SendRawEmail'],
            resources: ['*'], // Restrict this in production to specific identities
        }));

        // API Gateway
        const api = new apigateway.RestApi(this, 'ThirukkuralApi', {
            restApiName: 'Thirukkural Service',
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
            },
        });

        const sub = api.root.addResource('subscribe');
        sub.addMethod('POST', new apigateway.LambdaIntegration(subscribeFn));

        const unsub = api.root.addResource('unsubscribe');
        unsub.addMethod('POST', new apigateway.LambdaIntegration(unsubscribeFn));

        // EventBridge daily trigger
        const rule = new events.Rule(this, 'DailyKuralRule', {
            schedule: events.Schedule.cron({ minute: '0', hour: '1' }), // 01:00 UTC (6:30 AM IST)
        });
        rule.addTarget(new targets.LambdaFunction(sendEmailFn));

        // Outputs
        new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
        new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
        new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
        new cdk.CfnOutput(this, 'UserPoolDomain', { value: userPoolDomain.domainName });
    }
}
