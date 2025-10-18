import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { backend as backendFunction } from './functions/backend/resource';

export const backend = defineBackend({
  auth,
  data,
  backendFunction,
});
