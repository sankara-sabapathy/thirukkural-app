#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ThirukkuralStack } from '../lib/thirukkural-stack';

const app = new cdk.App();
new ThirukkuralStack(app, 'ThirukkuralStack', {
    env: { region: process.env.AWS_REGION || 'ap-south-1' },
});
app.synth();
