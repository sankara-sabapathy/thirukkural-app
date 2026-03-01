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
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as path from 'path';

export interface ThirukkuralStackProps extends cdk.StackProps {
    readonly stage: string;
}

export class ThirukkuralStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: ThirukkuralStackProps) {
        super(scope, id, props);

        const stage = props.stage;
        const isProd = stage === 'prod';
        const removalPolicy = isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

        // --- Configuration (SSM & Secrets Manager) ---
        const ssmPrefix = `/${stage}/thirukkural`;

        // Helper to get string from SSM (NOT secret)
        const getParam = (name: string) =>
            ssm.StringParameter.valueForStringParameter(this, `${ssmPrefix}/${name}`);

        // Helper to get secret ARN or Value Logic
        // Note: For secure strings, we pass the parameter NAME to Lambda, 
        // and Lambda fetches it at runtime to avoid exposing it in CloudFormation templates.
        const getSecretParamName = (name: string) => `${ssmPrefix}/${name}`;

        const baseDomain = getParam('base_domain');
        const emailSenderName = getParam('email_sender_name');
        const emailSenderAddress = getParam('email_sender_address');
        const emailReplyTo = getParam('email_reply_to');
        const emailProvider = getParam('email_provider');
        const acmCertArnApi = getParam('acm_certificate_arn_api');
        const acmCertArnCloudfront = getParam('acm_certificate_arn_cloudfront');
        const vapidPublicKey = getParam('vapid_public_key');
        const vapidSubject = getParam('vapid_subject');

        // Derived Domains
        // Prod: api.krss.online, thirukkural.krss.online
        // Others: {stage}-api.krss.online, {stage}-thirukkural.krss.online
        // Dynamic Domains
        const apiDomainName = isProd ? `api.${baseDomain}` : `${stage}-api.${baseDomain}`;
        const siteDomainName = isProd ? baseDomain : `${stage}.${baseDomain}`;

        // Let's use specific domain logic based on stage to be safe, assuming baseDomain is 'krss.online'
        // If baseDomain is flexible, we might need to pass full domains in SSM. 
        // For now, constructing it is standard.

        // DynamoDB tables
        const kuralTable = new dynamodb.Table(this, 'ThirukkuralTable', {

            partitionKey: { name: 'kuralId', type: dynamodb.AttributeType.NUMBER },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy,
        });

        const usersTable = new dynamodb.Table(this, 'UsersTable', {

            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy,
        });

        usersTable.addGlobalSecondaryIndex({
            indexName: 'EmailIndex',
            partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });

        const rateLimitTable = new dynamodb.Table(this, 'RateLimitTable', {

            partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
            timeToLiveAttribute: 'ttl',
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy,
        });

        const pushSubscriptionsTable = new dynamodb.Table(this, 'PushSubscriptionsTable', {

            partitionKey: { name: 'deviceId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy,
            timeToLiveAttribute: 'ttl',
        });

        // Cognito User Pool
        const userPool = new cognito.UserPool(this, 'UserPool', {

            selfSignUpEnabled: true,
            signInAliases: { email: true },
            removalPolicy,
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true,
            },
            autoVerify: { email: true },
        });

        // Google Identity Provider
        // We fetching Client ID/Secret from SSM/SecretsManager
        // Note: For CloudFormation to configure IdP, it needs the actual value at deploy time.
        // Standard SSM String (Client ID) is fine. 
        // SecureString (Client Secret) is tricky. CloudFormation natively supports resolving Secrets Manager or SSM SecureString (dynamic references).

        const googleClientId = getParam('google_client_id');
        // Changed to standard String to avoid CloudFormation 'SSM Secure reference not supported' error
        // User has updated SSM parameter type to String manually.
        // We use SecretValue.unsafePlainText because UserPoolIdentityProviderGoogle expects a SecretValue,
        // but we want to pass the resolved string from SSM.
        const googleClientSecretString = ssm.StringParameter.valueForStringParameter(this, `${ssmPrefix}/google_client_secret`);
        const googleClientSecret = cdk.SecretValue.unsafePlainText(googleClientSecretString);

        const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleIdP', {
            clientId: googleClientId,
            clientSecretValue: googleClientSecret,
            userPool,
            scopes: ['profile', 'email', 'openid'],
            attributeMapping: {
                email: cognito.ProviderAttribute.GOOGLE_EMAIL,
                givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
                familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
                profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
            },
        });

        const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
            userPool,
            userPoolClientName: isProd ? undefined : `thirukkural-client-${stage}`,
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
                    cognito.OAuthScope.COGNITO_ADMIN
                ],
                callbackUrls: [
                    'http://localhost:4200/callback',
                    `https://${siteDomainName}/callback`
                ],
                logoutUrls: [
                    'http://localhost:4200/',
                    `https://${siteDomainName}/`
                ],
            }
        });

        userPoolClient.node.addDependency(googleProvider);

        // Domain Prefix Logic:
        // Prod: thirukkural-app-{account} (Legacy)
        // Others: thirukkural-{stage}-{account}
        const userPoolDomainPrefix = isProd
            ? 'thirukkural-app-' + this.account
            : `thirukkural-${stage}-${this.account}`;

        const userPoolDomain = userPool.addDomain('UserPoolDomain', {
            cognitoDomain: {
                domainPrefix: userPoolDomainPrefix,
            },
        });

        // Lambda functions
        // Pass PARAMETER NAMES for secrets so Lambda can fetch them.
        const commonEnv = {
            STAGE: stage,
            ENABLE_PAYMENTS: 'true',
            KURAL_TABLE: kuralTable.tableName,
            USERS_TABLE: usersTable.tableName,
            RATE_LIMIT_TABLE: rateLimitTable.tableName,
            PUSH_SUBSCRIPTIONS_TABLE: pushSubscriptionsTable.tableName,

            // Config Parameters (Strings)
            EMAIL_SENDER_NAME: emailSenderName,
            EMAIL_SENDER_ADDRESS: emailSenderAddress,
            EMAIL_REPLY_TO: emailReplyTo,
            EMAIL_PROVIDER: emailProvider,
            VAPID_PUBLIC_KEY: vapidPublicKey,
            VAPID_SUBJECT: vapidSubject,

            // Parameter Paths for Runtime Fetching (Secrets)
            PARAM_GOOGLE_CLIENT_SECRET: getSecretParamName('google_client_secret'),
            PARAM_VAPID_PRIVATE_KEY: getSecretParamName('vapid_private_key'),
            PARAM_CLOUDFLARE_SECRET_KEY: getSecretParamName('cloudflare_secret_key'),
            PARAM_UNSUBSCRIBE_SECRET: getSecretParamName('unsubscribe_secret'),
            PARAM_BREVO_API_KEY: getSecretParamName('brevo_api_key'),
            PARAM_RAZORPAY_KEY_ID: getSecretParamName('razorpay_key_id'),
            PARAM_RAZORPAY_KEY_SECRET: getSecretParamName('razorpay_key_secret'),
            PARAM_RAZORPAY_WEBHOOK_SECRET: getSecretParamName('razorpay_webhook_secret'),
            PARAM_TELEGRAM_BOT_TOKEN: getSecretParamName('telegram_bot_token'),
            PARAM_TELEGRAM_CHANNEL_ID: getSecretParamName('telegram_channel_id'),
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
            entry: path.join(__dirname, '../src/handlers/user-profile.ts'),
            ...nodeJsProps,
            timeout: cdk.Duration.seconds(60),
            memorySize: 256,
        });

        const sendEmailFn = new nodejs.NodejsFunction(this, 'SendDailyEmailFn', {
            entry: path.join(__dirname, '../src/handlers/send-daily-email.ts'),
            timeout: cdk.Duration.minutes(15),
            runtime: lambda.Runtime.NODEJS_20_X,
            environment: commonEnv,
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

        const unsubscribeEmailFn = new nodejs.NodejsFunction(this, 'UnsubscribeEmailFn', {
            entry: path.join(__dirname, '../src/handlers/unsubscribe.ts'),
            ...nodeJsProps,
        });

        const unsubscribePushFn = new nodejs.NodejsFunction(this, 'UnsubscribePushFn', {
            entry: path.join(__dirname, '../src/handlers/unsubscribe-push.ts'),
            ...nodeJsProps,
        });

        const razorpayFn = new nodejs.NodejsFunction(this, 'RazorpayFn', {
            entry: path.join(__dirname, '../src/handlers/razorpay-handler.ts'),
            ...nodeJsProps,
            timeout: cdk.Duration.seconds(60),
            memorySize: 256,
        });

        // Permissions
        kuralTable.grantReadData(sendEmailFn);
        kuralTable.grantReadData(sendSampleEmailFn);
        usersTable.grantReadWriteData(userProfileFn);
        usersTable.grantReadWriteData(sendEmailFn);
        usersTable.grantReadWriteData(unsubscribeEmailFn);
        rateLimitTable.grantReadWriteData(sendSampleEmailFn);
        pushSubscriptionsTable.grantReadWriteData(subscribePushFn);
        pushSubscriptionsTable.grantReadWriteData(sendEmailFn);
        pushSubscriptionsTable.grantReadWriteData(unsubscribePushFn);

        // Grant Payment Lambda access to Users Table
        usersTable.grantReadWriteData(razorpayFn);

        // Grant SSM Read Permissions to Lambdas
        const ssmPolicy = new iam.PolicyStatement({
            actions: ['ssm:GetParameter', 'ssm:GetParameters'],
            resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter${ssmPrefix}/*`],
        });

        const lambdas = [
            userProfileFn, sendEmailFn, sendSampleEmailFn,
            subscribePushFn, unsubscribeEmailFn, unsubscribePushFn
        ];

        lambdas.forEach(fn => fn.addToRolePolicy(ssmPolicy));

        razorpayFn.addToRolePolicy(ssmPolicy);

        const sesPolicy = new iam.PolicyStatement({
            actions: ['ses:SendEmail', 'ses:SendRawEmail'],
            resources: ['*'],
        });

        sendEmailFn.addToRolePolicy(sesPolicy);
        sendSampleEmailFn.addToRolePolicy(sesPolicy);

        // API Gateway
        const api = new apigateway.RestApi(this, 'ThirukkuralApi', {
            restApiName: `Thirukkural Service (${stage})`,
            deployOptions: {
                stageName: stage,
                throttlingRateLimit: isProd ? 100 : 10,
                throttlingBurstLimit: isProd ? 200 : 20,
                tracingEnabled: true,
            },
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
            },
        });

        // Cloudflare Protection Policy (Dynamic)
        // Since we are now fetching the secret at runtime in Lambda validation layer (if we move logic there)
        // OR we can still use the Authorizer approach.
        // For the Resource Policy on API Gateway, we NEED the value at deployment time to write the policy.
        // CloudFormation Dynamic References to SecureString are supported in some properties, 
        // but IAM Policies can be tricky with Dynamic References.
        // HOWEVER, standard practice for simple WAF-like check:
        // Use a Custom Authorizer Lambda if we want strictly runtime check.
        // OR risk creating the policy with a resolve.
        // `cdk.SecretValue.ssmSecure` produces a token like `{{resolve:ssm-secure:...}}`.
        // API Gateway Policy supports this.

        const cfSecret = cdk.SecretValue.ssmSecure(`${ssmPrefix}/cloudflare_secret_key`);

        api.root.addResource('policy-check').addMethod('GET', new apigateway.MockIntegration({
            integrationResponses: [{ statusCode: '200' }],
            requestTemplates: { 'application/json': '{"statusCode": 200}' },
        }));
        // Note: The original policy was conditional on 'cloudflareSecretKey'. 
        // We will assume it exists for enterprise deployment.
        // NOTE: IAM Policy Conditions with `aws:Referer` vs resolve:ssm-secure might expose the secret in the policy document if viewed in console.
        // But usually acceptable for this token.

        const policy = new iam.PolicyDocument({
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
                            'aws:Referer': cfSecret.toString()
                        }
                    }
                })
            ]
        });
        // api.policy = policy; // TODO: Uncomment when ready to enforce

        // Custom Domain
        const apiDomain = new apigateway.DomainName(this, 'ApiDomain', {
            domainName: apiDomainName,
            certificate: acm.Certificate.fromCertificateArn(this, 'ApiCertificate', acmCertArnApi),
            endpointType: apigateway.EndpointType.REGIONAL,
        });

        new apigateway.BasePathMapping(this, 'ApiMapping', {
            domainName: apiDomain,
            restApi: api,
        });

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

        const unsubscribeEmail = api.root.addResource('unsubscribe');
        unsubscribeEmail.addMethod('POST', new apigateway.LambdaIntegration(unsubscribeEmailFn), {
            methodResponses: [
                { statusCode: '200' },
                { statusCode: '400' },
            ],
        });

        const subscribeWithDeviceId = subscribe.addResource('{deviceId}');
        subscribeWithDeviceId.addMethod('DELETE', new apigateway.LambdaIntegration(unsubscribePushFn));

        // Payment Routes
        const payment = api.root.addResource('payment');

        // POST /payment/order (Create Order for Credits)
        payment.addResource('order').addMethod('POST', new apigateway.LambdaIntegration(razorpayFn), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });

        // POST /payment/subscription (Create Subscription)
        payment.addResource('subscription').addMethod('POST', new apigateway.LambdaIntegration(razorpayFn), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });

        // POST /payment/webhook (Razorpay Webhook)
        // No Authorizer - Signature Validation inside Lambda
        payment.addResource('webhook').addMethod('POST', new apigateway.LambdaIntegration(razorpayFn));

        // POST /payment/verify (Verify Signature from Client)
        payment.addResource('verify').addMethod('POST', new apigateway.LambdaIntegration(razorpayFn), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });

        // POST /payment/cancel (Cancel Subscription)
        payment.addResource('cancel').addMethod('POST', new apigateway.LambdaIntegration(razorpayFn), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });

        // EventBridge Rule
        const rule = new events.Rule(this, 'DailyKuralRule', {
            schedule: events.Schedule.cron({ minute: '30', hour: '2' }),
            enabled: isProd,
        });

        rule.addTarget(new targets.LambdaFunction(sendEmailFn));


        // --- Frontend Hosting (S3 + CloudFront) ---
        const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
            bucketName: isProd ? undefined : `thirukkural-app-${stage}-${this.account}`,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Frontend content is reproducible
            autoDeleteObjects: true,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
        });

        const functionAssociations: cloudfront.FunctionAssociation[] = [];

        if (!isProd) {
            const basicAuthFn = new cloudfront.Function(this, 'BasicAuthFn', {
                code: cloudfront.FunctionCode.fromFile({
                    filePath: path.join(__dirname, '../src/cloudfront/basic-auth.js'),
                }),
                runtime: cloudfront.FunctionRuntime.JS_2_0,
            });

            functionAssociations.push({
                function: basicAuthFn,
                eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            });
        }

        const distribution = new cloudfront.Distribution(this, 'WebsiteDistribution', {
            defaultBehavior: {
                origin: S3BucketOrigin.withOriginAccessControl(websiteBucket),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
                functionAssociations: functionAssociations,
            },
            defaultRootObject: 'index.html',
            domainNames: [siteDomainName],
            certificate: acm.Certificate.fromCertificateArn(this, 'SiteCertificate', acmCertArnCloudfront),
            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                },
                {
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                },
            ],
        });

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
        new cdk.CfnOutput(this, 'ApiUrl', { value: `https://${apiDomainName}` }); // IMPORTANT: For Cloudflare CNAME
        new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
        new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
        new cdk.CfnOutput(this, 'UserPoolDomain', { value: userPoolDomain.baseUrl() });
        new cdk.CfnOutput(this, 'WebsiteUrl', { value: distribution.distributionDomainName }); // IMPORTANT: For Cloudflare CNAME
        new cdk.CfnOutput(this, 'WebsiteBucketName', { value: websiteBucket.bucketName });
        new cdk.CfnOutput(this, 'KuralTableName', { value: kuralTable.tableName });
    }
}
