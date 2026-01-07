const BASE = require('../../../config/jest.base.config');

module.exports = {
  ...BASE,
  displayName: 'soql-common',
  verbose: true,
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '/out/', '/lib/', '/soql-parser.lib/']
};
