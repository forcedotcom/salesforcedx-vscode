const baseConfig = require('../../config/jest.base.config.js');

module.exports = {
  ...baseConfig,
  displayName: 'salesforcedx-vscode-apex-testing',
  roots: ['<rootDir>/test'],
  // Enable isolatedModules for faster test execution
  // This package doesn't use dynamic imports, so it's safe
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }]
  }
};
