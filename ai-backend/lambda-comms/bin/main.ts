#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LambdaCommsStack } from '../lib/lambda-comms-cdk';

const app = new cdk.App();
new LambdaCommsStack(app, 'LambdaCommsStack', {
  env: {
    account: '129671603264',
    region: 'us-east-1',
  },
});
