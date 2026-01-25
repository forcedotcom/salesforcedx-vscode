const baseConfig = require('../../config/jest.base.config');

module.exports = {
  ...baseConfig,
  displayName: '@salesforce/vscode-i18n',
  // Enable isolatedModules for faster test execution
  // This package doesn't use dynamic imports, so it's safe
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }]
  }
};
