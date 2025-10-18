import { defineFunction } from '@aws-amplify/backend';

export const backend = defineFunction({
  name: 'backend',
  entry: './handler.ts',
  runtime: 20,
});

