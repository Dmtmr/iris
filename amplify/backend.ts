import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { backend as backendFunction } from './functions/backend/resource';
import { Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';

export const backend = defineBackend({
  auth,
  data,
  backendFunction,
});

// Grant permission to invoke Lambda-Inbound
const lambdaInvokePolicy = new Policy(
  backend.backendFunction.resources.lambda,
  'InvokeLambdaInboundPolicy',
  {
    statements: [
      new PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: ['arn:aws:lambda:us-east-1:129671603264:function:lambda-inbound'],
      }),
    ],
  }
);

backend.backendFunction.resources.lambda.role?.attachInlinePolicy(lambdaInvokePolicy);
