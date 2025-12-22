import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { ThirukkuralStack } from '../../lib/thirukkural-stack';

describe('ThirukkuralStack Infrastructure Tests', () => {
    let app: cdk.App;
    let stack: ThirukkuralStack;
    let template: Template;

    beforeAll(() => {
        app = new cdk.App();
        stack = new ThirukkuralStack(app, 'MyTestStack', {
            env: { account: '123456789012', region: 'us-east-1' },
            stage: 'dev'
        });
        template = Template.fromStack(stack);
    });

    test('DynamoDB Tables Created with Correct Properties', () => {
        // Verify Users Table
        template.hasResourceProperties('AWS::DynamoDB::Table', {
            BillingMode: 'PAY_PER_REQUEST',
            KeySchema: [
                { AttributeName: 'userId', KeyType: 'HASH' }
            ]
        });

        // Verify Thirukkural Table
        template.hasResourceProperties('AWS::DynamoDB::Table', {
            BillingMode: 'PAY_PER_REQUEST',
            KeySchema: [
                { AttributeName: 'kuralId', KeyType: 'HASH' }
            ]
        });
    });

    test('Lambda Functions Created', () => {
        // Verify specifically logic related to environment variables exists on at least one function
        template.hasResourceProperties('AWS::Lambda::Function', {
            Runtime: 'nodejs20.x',
            Environment: {
                Variables: {
                    USERS_TABLE: { Ref: Match.anyValue() },
                }
            }
        });
    });

    test('API Gateway Created', () => {
        template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
        template.hasResourceProperties('AWS::ApiGateway::Stage', {
            StageName: 'dev',
            TracingEnabled: true
        });
    });

    test('EventBridge Rule for Daily Emails', () => {
        template.hasResourceProperties('AWS::Events::Rule', {
            ScheduleExpression: 'cron(30 2 * * ? *)', // 2:30 AM UTC
            State: 'DISABLED'
        });
    });
});
