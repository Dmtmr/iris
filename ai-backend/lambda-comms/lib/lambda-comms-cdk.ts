import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class LambdaCommsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Attach the same managed policies to the existing role (1:1 with current Lambda)
    const lambdaRole = iam.Role.fromRoleName(this, 'LambdaRole', 'lambda-ses-new-role');
    lambdaRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'));
    lambdaRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));
    lambdaRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSESFullAccess'));

    // Create Lambda function
    const lambdaFunction = new lambda.Function(this, 'LambdaComms', {
      functionName: 'lambda-comms',
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'lambda_comms.lambda_handler',
      code: lambda.Code.fromAsset('lambda_comms_src'),
      architecture: lambda.Architecture.ARM_64,
      role: lambdaRole,
      layers: [
        lambda.LayerVersion.fromLayerVersionArn(
          this, 'Pg8000Layer', 
          'arn:aws:lambda:us-east-1:129671603264:layer:pg8000-layer:1'
        )
      ],
      timeout: cdk.Duration.minutes(2),
      memorySize: 1024,
      maxEventAge: cdk.Duration.hours(6),
      retryAttempts: 2,
      environment: {
        'DB_HOST': 'email-system-cluster.cluster-csxy24404km6.us-east-1.rds.amazonaws.com',
        'DB_NAME': 'email_system',
        'DB_PASSWORD': 'i8*:7ud7Js>LVQuBdlEpLMWcI!o$',
        'DB_PORT': '5432',
        'DB_USER': 'postgres',
        'FROM_EMAIL': 'demo@irispro.xyz',
        'S3_BUCKET': 'iris-bucket101425',
        'SMTP_PASSWORD': 'AkwoCKgSShGcV0JMRKk+0wlJ3cfeVCXtA1JKIf1GRlH9',
        'SMTP_USERNAME': 'AKIAR4MIHURAJUCRYH55',
        'OPENAI_API_KEY': 'random-test-key-12345',
      },
      vpc: ec2.Vpc.fromVpcAttributes(this, 'VPC', {
        vpcId: 'vpc-0a483b03a3ad5ce23',
        availabilityZones: ['us-east-1a', 'us-east-1d'],
        privateSubnetIds: [
          'subnet-072b8b66feec6f52c',
          'subnet-0ffad26057440a18c'
        ],
        vpcCidrBlock: '172.31.0.0/16'
      }),
      vpcSubnets: {
        subnets: [
          ec2.Subnet.fromSubnetId(this, 'Subnet1', 'subnet-072b8b66feec6f52c'),
          ec2.Subnet.fromSubnetId(this, 'Subnet2', 'subnet-0ffad26057440a18c')
        ]
      },
      securityGroups: [
        ec2.SecurityGroup.fromSecurityGroupId(this, 'LambdaSecurityGroup', 'sg-063d280bc6cea3919')
      ]
    });

    // Add IAM permissions for S3, SES, and VPC access
    lambdaFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
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

    lambdaFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ses:*'],
      resources: ['*']
    }));

    // Add CloudWatch Logs permissions
    lambdaFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents'
      ],
      resources: ['*']
    }));

    // Add VPC/EC2 permissions
    lambdaFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
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
    lambdaFunction.addPermission('SESInvokePermission', {
      principal: new iam.ServicePrincipal('ses.amazonaws.com'),
      action: 'lambda:InvokeFunction'
    });
  }
}
