#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ThirukkuralStack } from '../lib/thirukkural-stack';

const app = new cdk.App();

const stage = app.node.tryGetContext('stage') || 'dev';
const stackName = stage === 'prod' ? 'ThirukkuralStack' : `ThirukkuralStack-${stage.charAt(0).toUpperCase() + stage.slice(1)}`;

console.log(`Synthesizing stack: ${stackName} for stage: ${stage}`);

new ThirukkuralStack(app, 'ThirukkuralStack', {
    stackName: stackName,
    env: {
        region: process.env.AWS_REGION || 'ap-south-1',
        account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID
    },
    stage: stage
});
app.synth();
