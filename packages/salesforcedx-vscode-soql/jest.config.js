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
  // Map @soql-common and @soql-model to actual source paths for Jest
  moduleNameMapper: {
    '^@soql-common/(.*)$': '<rootDir>/src/soql-common/$1',
    '^@soql-model/(.*)$': '<rootDir>/src/soql-model/$1'
  }
});
