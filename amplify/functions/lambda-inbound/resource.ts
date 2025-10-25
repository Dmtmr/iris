import { Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { Duration } from 'aws-cdk-lib';
import { defineBackend } from '@aws-amplify/backend';

// Create a minimal backend to get the stack reference
const backend = defineBackend();

// Define the Python Lambda using CDK constructs
export const lambdaInbound = new Function(backend.stack, 'lambda-inbound', {
  functionName: 'lambda-inbound',
  runtime: Runtime.PYTHON_3_9,
  handler: 'lambda_function.lambda_handler',
  code: Code.fromAsset('./src'), // relative to this resource.ts
  environment: {
    DB_HOST: 'email-system-cluster.cluster-csxy24404km6.us-east-1.rds.amazonaws.com',
    DB_NAME: 'email_system',
    DB_PASSWORD: 'i8*:7ud7Js>LVQuBdlEpLMWcI!o$',
    DB_PORT: '5432',
    DB_USER: 'postgres',
    FROM_EMAIL: 'demo@irispro.xyz',
    S3_BUCKET: 'iris-bucket101425',
    SMTP_PASSWORD: 'AkwoCKgSShGcV0JMRKk+0wlJ3cfeVCXtA1JKIf1GRlH9',
    SMTP_USERNAME: 'AKIAR4MIHURAJUCRYH55',
    AWS_REGION: 'us-east-1',
    OPENAI_API_KEY: 'random-test-key-12345',
  },
  timeout: Duration.minutes(5),
  memorySize: 512,
});
