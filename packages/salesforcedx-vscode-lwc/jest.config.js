// eslint:disable-next-line:no-var-requires
const baseConfig = require('../../config/jest.base.config');

module.exports = Object.assign({}, baseConfig, {
  // Enable isolatedModules for faster test execution
  // This package doesn't use dynamic imports, so it's safe
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }]
  }
});