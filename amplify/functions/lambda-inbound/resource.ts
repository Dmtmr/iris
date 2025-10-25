import { Function, Runtime, Code, LayerVersion, Architecture } from 'aws-cdk-lib/aws-lambda';
import { Duration } from 'aws-cdk-lib';
import { Vpc, SecurityGroup, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { PolicyStatement, Effect, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { defineBackend } from '@aws-amplify/backend';
import { auth } from '../../auth/resource';
import { data } from '../../data/resource';

// Reference the main backend to get the stack
const backend = defineBackend({
  auth,
  data,
});

// Define the Python Lambda using CDK constructs
export const lambdaInbound = new Function(backend.stack, 'lambda-comms', {
  functionName: 'lambda-comms',
  runtime: Runtime.PYTHON_3_9,
  handler: 'lambda_function.lambda_handler',
  code: Code.fromAsset('./src'), // relative to this resource.ts
  architecture: Architecture.X86_64, // Match existing: x86_64
  layers: [
    LayerVersion.fromLayerVersionArn(backend.stack, 'Pg8000Layer', 'arn:aws:lambda:us-east-1:129671603264:layer:pg8000-layer:1')
  ],
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
  timeout: Duration.minutes(2), // Match existing: 2min0sec
  memorySize: 1024, // Match existing: 1024MB
  maxEventAge: Duration.hours(6), // Match existing: 6h0min0sec
  retryAttempts: 2, // Match existing: 2 retry attempts
  vpc: Vpc.fromLookup(backend.stack, 'VPC', {
    vpcId: 'vpc-0a483b03a3ad5ce23',
  }),
  vpcSubnets: {
    subnetType: SubnetType.PRIVATE_WITH_EGRESS,
    subnets: ['subnet-072b8b66feec6f52c', 'subnet-0ffad26057440a18c'],
  },
  securityGroups: [
    SecurityGroup.fromSecurityGroupId(backend.stack, 'LambdaSecurityGroup', 'sg-063d280bc6cea3919'),
  ],
});

// Add IAM permissions for S3, SES, and VPC access
lambdaInbound.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: [
    's3:GetObject',
    's3:PutObject',
    's3:DeleteObject',
    's3:PutObjectAcl',
    's3:ListBucket'
  ],
  resources: [
    'arn:aws:s3:::iris-bucket101425',
    'arn:aws:s3:::iris-bucket101425/*'
  ]
}));

lambdaInbound.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['ses:*'],
  resources: ['*']
}));

// Add CloudWatch Logs permissions
lambdaInbound.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: [
    'logs:CreateLogGroup',
    'logs:CreateLogStream',
    'logs:PutLogEvents'
  ],
  resources: ['*']
}));

// Add VPC/EC2 permissions
lambdaInbound.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: [
    'ec2:CreateNetworkInterface',
    'ec2:DescribeNetworkInterfaces',
    'ec2:DescribeSubnets',
    'ec2:DeleteNetworkInterface',
    'ec2:AssignPrivateIpAddresses',
    'ec2:UnassignPrivateIpAddresses'
  ],
  resources: ['*']
}));

// Add resource-based policy for SES to invoke the Lambda
lambdaInbound.addPermission('SESInvokePermission', {
  principal: new ServicePrincipal('ses.amazonaws.com'),
  action: 'lambda:InvokeFunction',
});
