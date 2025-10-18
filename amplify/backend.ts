import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { defineFunction } from '@aws-amplify/backend';

// Define the JavaScript Lambda
const backendLambda = defineFunction({
  name: 'backend',
  entry: './amplify/functions/backend/lambda-function.js',
});

// Export backend
export const backend = defineBackend({
  auth,
  data,
  backendLambda,
});
