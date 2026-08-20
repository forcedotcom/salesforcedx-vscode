// eslint:disable-next-line:no-var-requires
const baseConfig = require('../../config/jest.base.config');

module.exports = Object.assign({}, baseConfig, {
  testPathIgnorePatterns: [
    ...(baseConfig.testPathIgnorePatterns || []),
    '/test/jest/soql-builder-ui/',
    '/test/jest/queryDataView/queryDataViewController.test.ts'
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }]
  }
});
