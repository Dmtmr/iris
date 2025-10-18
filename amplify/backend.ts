import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';

// Export backend
export const backend = defineBackend({
  auth,
  data,
});
