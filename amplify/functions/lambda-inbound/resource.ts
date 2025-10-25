import { defineFunction } from '@aws-amplify/backend';

export const lambdaInbound = defineFunction({
  name: 'lambda-inbound',
  entry: './src/lambda_function.py',
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
});
