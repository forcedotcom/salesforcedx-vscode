// eslint:disable-next-line:no-var-requires
const baseConfig = require('../../config/jest.base.config');

module.exports = Object.assign({}, baseConfig, {
  testPathIgnorePatterns: [
    ...(baseConfig.testPathIgnorePatterns || []),
    '/test/jest/soql-builder-ui/'
  ],
  // Enable isolatedModules for faster test execution
  // This package doesn't use dynamic imports, so it's safe
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }]
  },
  // Map @salesforce/soql-common and @salesforce/soql-model to actual source paths for Jest
  moduleNameMapper: {
    '^@salesforce/soql-common/(.*)$': '<rootDir>/src/soql-common/$1',
    '^@salesforce/soql-model/(.*)$': '<rootDir>/src/soql-model/$1'
  }
});
