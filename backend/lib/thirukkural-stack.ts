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
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
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

        const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
            userPool,
            generateSecret: false, // SPA client
            oAuth: {
                flows: {
                    authorizationCodeGrant: true,
                },
                scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE, cognito.OAuthScope.OPENID],
                callbackUrls: ['http://localhost:4200/callback'], // Update for prod
                logoutUrls: ['http://localhost:4200/'],
            }
        });

        // Placeholder for Google Client ID/Secret
        const googleClientId = process.env.GOOGLE_CLIENT_ID || 'PLACEHOLDER_CLIENT_ID';
        const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || 'PLACEHOLDER_CLIENT_SECRET';

        if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
            const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleIdP', {
                clientId: googleClientId,
                clientSecretValue: cdk.SecretValue.unsafePlainText(googleClientSecret), // Use clientSecretValue
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
            USERS_TABLE: usersTable.tableName,
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
            timeout: cdk.Duration.minutes(5), // Allow more time for sending emails
            ...nodeJsProps,
        });

        // Permissions
        kuralTable.grantReadData(sendEmailFn);
        usersTable.grantReadWriteData(userProfileFn);
        usersTable.grantReadData(sendEmailFn);

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
                allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
            },
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

        const distribution = new cloudfront.Distribution(this, 'WebsiteDistribution', {
            defaultBehavior: {
                origin: new origins.S3Origin(websiteBucket),
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
        });

        // Attach OAC to Distribution (L1 construct workaround as L2 doesn't fully support OAC yet in all versions)
        const cfnDistribution = distribution.node.defaultChild as cloudfront.CfnDistribution;
        cfnDistribution.addPropertyOverride('DistributionConfig.Origins.0.OriginAccessControlId', oac.attrId);

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

        // Deploy Frontend Assets
        // Note: This expects the frontend to be built at ../frontend/dist/thirukkural-app
        // We use a try-catch or check existence in a real pipeline, but for CDK we assume it exists or create a placeholder.
        // For this open-source setup, we will point to the dist folder.
        new s3deploy.BucketDeployment(this, 'DeployWebsite', {
            sources: [s3deploy.Source.asset(path.join(__dirname, '../../../frontend/dist/thirukkural-app'))],
            destinationBucket: websiteBucket,
            distribution,
            distributionPaths: ['/*'], // Invalidate cache
        });

        // Outputs
        new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
        new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
        new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
        new cdk.CfnOutput(this, 'UserPoolDomain', { value: userPoolDomain.domainName });
        new cdk.CfnOutput(this, 'WebsiteUrl', { value: distribution.distributionDomainName });
    }
}
