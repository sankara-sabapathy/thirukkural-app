import * as dotenv from 'dotenv';
dotenv.config();
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
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as path from 'path';

export class ThirukkuralStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // --- Environment Configuration & Validation ---
        const googleClientId = process.env.GOOGLE_CLIENT_ID;
        const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const sesSenderEmail = process.env.SES_SENDER_EMAIL || 'noreply@example.com';
        const baseDomain = process.env.BASE_DOMAIN || 'example.com'; // e.g., krss.online
        const cloudflareSecretKey = process.env.CLOUDFLARE_SECRET_KEY;
        const apiCertArn = process.env.ACM_CERTIFICATE_ARN_API;
        const cloudfrontCertArn = process.env.ACM_CERTIFICATE_ARN_CLOUDFRONT;
        const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
        const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
        const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:example@example.com';

        // Derived Domains
        const apiDomainName = `api.${baseDomain}`;
        const appDomainName = `thirukkural.${baseDomain}`;

        // Validate critical secrets for production-like deployments
        if (!googleClientId || !googleClientSecret) {
            console.warn('WARNING: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not provided. Cognito Google IdP will not be created.');
        }
        if (!cloudflareSecretKey) {
            console.warn('WARNING: CLOUDFLARE_SECRET_KEY not provided. API Gateway will be open to public access.');
        }

        // DynamoDB tables
        const kuralTable = new dynamodb.Table(this, 'ThirukkuralTable', {
            partitionKey: { name: 'kuralId', type: dynamodb.AttributeType.NUMBER },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        const usersTable = new dynamodb.Table(this, 'UsersTable', {
            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        // GSI for email lookups if needed (e.g. for admin tools or debugging)
        usersTable.addGlobalSecondaryIndex({
            indexName: 'EmailIndex',
            partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });

        const rateLimitTable = new dynamodb.Table(this, 'RateLimitTable', {
            partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
            timeToLiveAttribute: 'ttl',
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        const pushSubscriptionsTable = new dynamodb.Table(this, 'PushSubscriptionsTable', {
            partitionKey: { name: 'deviceId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            timeToLiveAttribute: 'ttl',
        });

        // Cognito User Pool with Google IdP
        const userPool = new cognito.UserPool(this, 'UserPool', {
            selfSignUpEnabled: true,
            signInAliases: { email: true },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true,
            },
            autoVerify: { email: true },
        });

        // Google Identity Provider setup
        let googleProvider: cognito.UserPoolIdentityProviderGoogle | undefined;
        if (googleClientId && googleClientSecret) {
            googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleIdP', {
                clientId: googleClientId,
                clientSecretValue: cdk.SecretValue.unsafePlainText(googleClientSecret),
                userPool,
                scopes: ['profile', 'email', 'openid'],
                attributeMapping: {
                    email: cognito.ProviderAttribute.GOOGLE_EMAIL,
                    givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
                    familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
                    profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
                },
            });
        }

        const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
            userPool,
            generateSecret: false, // SPA client
            supportedIdentityProviders: [
                cognito.UserPoolClientIdentityProvider.GOOGLE,
            ],
            oAuth: {
                flows: {
                    authorizationCodeGrant: true,
                },
                scopes: [
                    cognito.OAuthScope.EMAIL,
                    cognito.OAuthScope.PROFILE,
                    cognito.OAuthScope.OPENID,
                    cognito.OAuthScope.COGNITO_ADMIN // Required for fetchUserAttributes
                ],
                callbackUrls: [
                    'http://localhost:4200/callback',
                    `https://${appDomainName}/callback`
                ],
                logoutUrls: [
                    'http://localhost:4200/',
                    `https://${appDomainName}/`
                ],
            }
        });

        // Add dependency to ensure Google provider is created before the client
        if (googleProvider) {
            userPoolClient.node.addDependency(googleProvider);
        }

        const userPoolDomain = userPool.addDomain('UserPoolDomain', {
            cognitoDomain: {
                domainPrefix: 'thirukkural-app-' + this.account, // Unique domain
            },
        });

        // Lambda functions
        const commonEnv = {
            KURAL_TABLE: kuralTable.tableName,
            USERS_TABLE: usersTable.tableName,
            RATE_LIMIT_TABLE: rateLimitTable.tableName,
            PUSH_SUBSCRIPTIONS_TABLE: pushSubscriptionsTable.tableName,
            SES_SENDER: sesSenderEmail,
            VAPID_PUBLIC_KEY: vapidPublicKey,
            VAPID_SUBJECT: vapidSubject,
            EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'SES',
            BREVO_API_KEY: process.env.BREVO_API_KEY || '',
            EMAIL_SENDER_NAME: process.env.EMAIL_SENDER_NAME || 'Thirukkural Daily',
            EMAIL_SENDER_ADDRESS: process.env.EMAIL_SENDER_ADDRESS || 'noreply@example.com',
            EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO || 'noreply@example.com',
        };

        // Sensitive push sender secrets - only for Lambdas that send notifications
        const pushSenderEnv = {
            VAPID_PRIVATE_KEY: vapidPrivateKey,
        };

        const nodeJsProps: nodejs.NodejsFunctionProps = {
            runtime: lambda.Runtime.NODEJS_20_X,
            environment: commonEnv,
            bundling: {
                minify: true,
                sourceMap: true,
            },
        };

        const userProfileFn = new nodejs.NodejsFunction(this, 'UserProfileFn', {
            entry: path.join(__dirname, '../src/handlers/user-profile.ts'), // Corrected path
            ...nodeJsProps,
        });

        const sendEmailFn = new nodejs.NodejsFunction(this, 'SendDailyEmailFn', {
            entry: path.join(__dirname, '../src/handlers/send-daily-email.ts'),
            timeout: cdk.Duration.minutes(15), // Increased to 15 mins to allow 1s delay per user (max ~900 users)
            runtime: lambda.Runtime.NODEJS_20_X,
            environment: { ...commonEnv, ...pushSenderEnv },
            bundling: {
                minify: true,
                sourceMap: true,
            },
        });

        const sendSampleEmailFn = new nodejs.NodejsFunction(this, 'SendSampleEmailFn', {
            entry: path.join(__dirname, '../src/handlers/send-sample-email.ts'),
            timeout: cdk.Duration.seconds(30),
            ...nodeJsProps,
        });

        const subscribePushFn = new nodejs.NodejsFunction(this, 'SubscribePushFn', {
            entry: path.join(__dirname, '../src/handlers/subscribe-push.ts'),
            ...nodeJsProps,
        });

        // Permissions
        kuralTable.grantReadData(sendEmailFn);
        kuralTable.grantReadData(sendSampleEmailFn);
        usersTable.grantReadWriteData(userProfileFn);
        usersTable.grantReadData(sendEmailFn);
        rateLimitTable.grantReadWriteData(sendSampleEmailFn);
        pushSubscriptionsTable.grantReadWriteData(subscribePushFn);
        pushSubscriptionsTable.grantReadWriteData(sendEmailFn);

        const sesPolicy = new iam.PolicyStatement({
            actions: ['ses:SendEmail', 'ses:SendRawEmail'],
            resources: ['*'], // Restrict this in production to specific identities
        });

        sendEmailFn.addToRolePolicy(sesPolicy);
        sendSampleEmailFn.addToRolePolicy(sesPolicy);

        // API Gateway with Stricter Throttling (Free Layer 1 Defense)
        const api = new apigateway.RestApi(this, 'ThirukkuralApi', {
            restApiName: 'Thirukkural Service',
            deployOptions: {
                stageName: 'prod',
                throttlingRateLimit: 100, // 100 requests per second (reasonable for small app)
                throttlingBurstLimit: 200, // Allow bursts of 200 requests
                tracingEnabled: true,
            },
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
            },
            // --- Cloudflare Security Integration ---
            // This policy ensures only requests coming from Cloudflare (with the secret header) are accepted.
            // UNCOMMENT the policy below AFTER you have configured Cloudflare Transform Rules.
            policy: cloudflareSecretKey ? new iam.PolicyDocument({
                statements: [
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        principals: [new iam.AnyPrincipal()],
                        actions: ['execute-api:Invoke'],
                        resources: ['execute-api:/*'],
                    }),
                    new iam.PolicyStatement({
                        effect: iam.Effect.DENY,
                        principals: [new iam.AnyPrincipal()],
                        actions: ['execute-api:Invoke'],
                        resources: ['execute-api:/*'],
                        conditions: {
                            StringNotEquals: {
                                'aws:Referer': cloudflareSecretKey
                            }
                        }
                    })
                ]
            }) : undefined
        });

        // --- Custom Domain for API (Required for Cloudflare) ---
        // 1. Create a Certificate in ACM (us-east-1 or region) for api.krss.online
        // 2. Uncomment the code below
        if (apiCertArn) {
            const apiDomain = new apigateway.DomainName(this, 'ApiDomain', {
                domainName: apiDomainName,
                certificate: acm.Certificate.fromCertificateArn(this, 'ApiCertificate', apiCertArn),
                endpointType: apigateway.EndpointType.REGIONAL, // Regional is better for Cloudflare
            });

            // Map the domain to this API
            new apigateway.BasePathMapping(this, 'ApiMapping', {
                domainName: apiDomain,
                restApi: api,
            });
        }

        const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
            cognitoUserPools: [userPool],
        });

        const profile = api.root.addResource('profile');
        profile.addMethod('GET', new apigateway.LambdaIntegration(userProfileFn), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        profile.addMethod('PUT', new apigateway.LambdaIntegration(userProfileFn), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });

        const sampleEmail = api.root.addResource('sample-email');
        sampleEmail.addMethod('POST', new apigateway.LambdaIntegration(sendSampleEmailFn));

        const subscribe = api.root.addResource('subscribe');
        subscribe.addMethod('POST', new apigateway.LambdaIntegration(subscribePushFn), {
            methodResponses: [
                { statusCode: '200' },
                { statusCode: '400' },
                { statusCode: '429' },
            ],
        });

        // Unsubscribe push notification endpoint
        const unsubscribePushFn = new nodejs.NodejsFunction(this, 'UnsubscribePushFn', {
            entry: path.join(__dirname, '../src/handlers/unsubscribe-push.ts'),
            ...nodeJsProps,
        });
        pushSubscriptionsTable.grantReadWriteData(unsubscribePushFn);

        const subscribeWithDeviceId = subscribe.addResource('{deviceId}');
        subscribeWithDeviceId.addMethod('DELETE', new apigateway.LambdaIntegration(unsubscribePushFn));


        // EventBridge daily trigger
        // 8 AM IST = 2:30 AM UTC
        const rule = new events.Rule(this, 'DailyKuralRule', {
            schedule: events.Schedule.cron({ minute: '30', hour: '2' }),
        });
        rule.addTarget(new targets.LambdaFunction(sendEmailFn));

        // --- Frontend Hosting (S3 + CloudFront) ---

        const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // Secure: No public access
            encryption: s3.BucketEncryption.S3_MANAGED,
        });

        // Custom Domain Configuration (Uncomment and update after creating ACM Certificate)

        // 1. Request a certificate in us-east-1 for thirukkural.krss.online
        // 2. Validate it (DNS validation recommended)
        // 3. Paste the ARN below
        const distributionProps: cloudfront.DistributionProps = {
            defaultBehavior: {
                origin: S3BucketOrigin.withOriginAccessControl(websiteBucket),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
            },
            defaultRootObject: 'index.html',
            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html', // SPA Routing
                },
                {
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                },
            ],
        };

        if (cloudfrontCertArn) {
            Object.assign(distributionProps, {
                domainNames: [appDomainName],
                certificate: acm.Certificate.fromCertificateArn(this, 'SiteCertificate', cloudfrontCertArn),
            });
        }

        const distribution = new cloudfront.Distribution(this, 'WebsiteDistribution', distributionProps);

        // Bucket Policy to allow CloudFront OAC
        websiteBucket.addToResourcePolicy(new iam.PolicyStatement({
            actions: ['s3:GetObject'],
            resources: [websiteBucket.arnForObjects('*')],
            principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
            conditions: {
                StringEquals: {
                    'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`
                }
            }
        }));

        // Outputs
        new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
        new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
        new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
        new cdk.CfnOutput(this, 'UserPoolDomain', { value: userPoolDomain.domainName });
        new cdk.CfnOutput(this, 'WebsiteUrl', { value: distribution.distributionDomainName });
        new cdk.CfnOutput(this, 'WebsiteBucketName', { value: websiteBucket.bucketName }); // Export bucket name for frontend deploy
        new cdk.CfnOutput(this, 'KuralTableName', { value: kuralTable.tableName });
    }
}
