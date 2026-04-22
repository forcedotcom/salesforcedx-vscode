// eslint:disable-next-line:no-var-requires
const baseConfig = require('../../config/jest.base.config');

module.exports = Object.assign({}, baseConfig, {
  testPathIgnorePatterns: [
    ...(baseConfig.testPathIgnorePatterns || []),
    '/test/jest/soql-builder-ui/'
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }]
  },
  // Map @salesforce/soql-model to actual source path for Jest
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    '^@salesforce/soql-model/(.*)$': '<rootDir>/src/soql-model/$1'
  }
});
