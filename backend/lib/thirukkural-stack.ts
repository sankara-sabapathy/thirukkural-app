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
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as path from 'path';

export class ThirukkuralStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

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
        const googleClientId = process.env.GOOGLE_CLIENT_ID || 'PLACEHOLDER_CLIENT_ID';
        const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || 'PLACEHOLDER_CLIENT_SECRET';

        let googleProvider: cognito.UserPoolIdentityProviderGoogle | undefined;
        if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
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
                    'https://d232e1w18ndbh2.cloudfront.net/callback'
                ],
                logoutUrls: [
                    'http://localhost:4200/',
                    'https://d232e1w18ndbh2.cloudfront.net/'
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

        const userProfileFn = new nodejs.NodejsFunction(this, 'UserProfileFn', {
            entry: path.join(__dirname, '../src/handlers/user-profile.ts'), // Corrected path
            ...nodeJsProps,
        });

        const sendEmailFn = new nodejs.NodejsFunction(this, 'SendDailyEmailFn', {
            entry: path.join(__dirname, '../src/handlers/send-daily-email.ts'), // Corrected path
            timeout: cdk.Duration.minutes(15), // Increased to 15 mins to allow 1s delay per user (max ~900 users)
            ...nodeJsProps,
        });

        const sendSampleEmailFn = new nodejs.NodejsFunction(this, 'SendSampleEmailFn', {
            entry: path.join(__dirname, '../src/handlers/send-sample-email.ts'),
            ...nodeJsProps,
        });

        // Permissions
        kuralTable.grantReadData(sendEmailFn);
        kuralTable.grantReadData(sendSampleEmailFn);
        usersTable.grantReadWriteData(userProfileFn);
        usersTable.grantReadData(sendEmailFn);
        rateLimitTable.grantReadWriteData(sendSampleEmailFn);

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
                throttlingRateLimit: 5, // Strict: Max 5 requests per second
                throttlingBurstLimit: 10, // Strict: Allow bursts of only 10 requests
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
            /*
            policy: new iam.PolicyDocument({
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
                                'aws:Referer': 'YOUR_CLOUDFLARE_SECRET_KEY_12345' // Replace with a long random string
                            }
                        }
                    })
                ]
            })
            */
        });

        // --- Custom Domain for API (Required for Cloudflare) ---
        // 1. Create a Certificate in ACM (us-east-1 or region) for api.krss.online
        // 2. Uncomment the code below
        /*
        const apiDomain = new apigateway.DomainName(this, 'ApiDomain', {
            domainName: 'api.krss.online',
            certificate: acm.Certificate.fromCertificateArn(this, 'ApiCertificate', 'arn:aws:acm:REGION:ACCOUNT:certificate/ID'),
            endpointType: apigateway.EndpointType.REGIONAL, // Regional is better for Cloudflare
        });

        // Map the domain to this API
        new apigateway.BasePathMapping(this, 'ApiMapping', {
            domainName: apiDomain,
            restApi: api,
        });
        */

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

        // Origin Access Control (OAC) for CloudFront to access S3
        const oac = new cloudfront.CfnOriginAccessControl(this, 'WebsiteOAC', {
            originAccessControlConfig: {
                name: 'WebsiteOAC',
                originAccessControlOriginType: 's3',
                signingBehavior: 'always',
                signingProtocol: 'sigv4',
            },
        });

        // Custom Domain Configuration (Uncomment and update after creating ACM Certificate)

        // 1. Request a certificate in us-east-1 for thirukkural.krss.online
        // 2. Validate it (DNS validation recommended)
        // 3. Paste the ARN below
        const certificate = acm.Certificate.fromCertificateArn(this, 'SiteCertificate', 'arn:aws:acm:us-east-1:612850243659:certificate/294a386d-9fbd-4adf-ad5d-c3027d779260');

        const distribution = new cloudfront.Distribution(this, 'WebsiteDistribution', {
            defaultBehavior: {
                origin: new origins.S3Origin(websiteBucket),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
            },
            defaultRootObject: 'index.html',
            domainNames: ['thirukkural.krss.online'],
            certificate: certificate,
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
        });

        // Attach OAC to Distribution (L1 construct workaround as L2 doesn't fully support OAC yet in all versions)
        const cfnDistribution = distribution.node.defaultChild as cloudfront.CfnDistribution;
        cfnDistribution.addPropertyOverride('DistributionConfig.Origins.0.OriginAccessControlId', oac.attrId);
        // Remove OAI which S3Origin adds by default, to avoid "Cannot use both" error
        cfnDistribution.addPropertyOverride('DistributionConfig.Origins.0.S3OriginConfig.OriginAccessIdentity', '');

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
