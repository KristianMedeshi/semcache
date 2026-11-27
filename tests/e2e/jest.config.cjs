const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../..');

/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['**/*.e2e-spec.ts'],
  testTimeout: 30000,
  transform: {
    '^.+\\.(t|j)s$': [
      path.join(repoRoot, 'apps/semantic-cache-service/node_modules/ts-jest'),
      {
        tsconfig: path.join(repoRoot, 'tests/tsconfig.json'),
      },
    ],
  },
};
