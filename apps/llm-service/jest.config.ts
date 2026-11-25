import { createNestJestConfig } from '@semcache/shared-config/testing';

export default createNestJestConfig(process.cwd(), {
  testEnvironment: '<rootDir>/test/node-typed-array-env.cjs',
});
