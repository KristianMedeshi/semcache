const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../..');

/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['**/*.integration.spec.ts'],
  testTimeout: 30000,
  transform: {
    '^.+\\.(t|j)s$': [
      path.join(repoRoot, 'apps/semantic-cache-service/node_modules/ts-jest'),
      {
        tsconfig: path.join(repoRoot, 'tests/tsconfig.json'),
      },
    ],
  },
  modulePaths: [
    path.join(repoRoot, 'node_modules'),
    path.join(repoRoot, 'apps/semantic-cache-service/node_modules'),
    path.join(repoRoot, 'apps/knowledge-base-service/node_modules'),
    path.join(repoRoot, 'apps/dialog-service/node_modules'),
  ],
  moduleNameMapper: {
    '^@semcache/shared-types$': path.join(repoRoot, 'packages/shared-types/src/index.ts'),
    '^@semcache/shared-dtos$': path.join(repoRoot, 'packages/shared-dtos/src/index.ts'),
    '^@semcache/shared-config$': path.join(repoRoot, 'packages/shared-config/src/index.ts'),
    '^@semcache/shared-config/testing$': path.join(repoRoot, 'packages/shared-config/src/testing.ts'),
  },
};
