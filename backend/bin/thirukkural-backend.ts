#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ThirukkuralStack } from '../lib/thirukkural-stack';

const app = new cdk.App();
new ThirukkuralStack(app, 'ThirukkuralStack', {
    env: { region: process.env.AWS_REGION || 'us-east-1' },
});
app.synth();
