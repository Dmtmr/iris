import { defineFunction } from '@aws-amplify/backend';

export const backend = defineFunction({
  name: 'backend',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 30,
  environment: {
    LAMBDA_INBOUND_NAME: 'lambda-comms', // Name of your new CDK Lambda
  },
});

