import { defineFunction } from '@aws-amplify/backend';

export const messageHandler = defineFunction({
  name: 'messageHandler',
  entry: './handler.ts',
  runtime: 20,
  environment: {
    DATABASE_URL: 'postgresql://postgres:BXK3T7P?G9Z>OW1XTA.WSP.w_Yh<@email-system-cluster.cluster-csxy24404km6.us-east-1.rds.amazonaws.com:5432/email_system',
  }
});
