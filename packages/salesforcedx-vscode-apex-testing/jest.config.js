const baseConfig = require('../../config/jest.base.config.js');

module.exports = {
  ...baseConfig,
  displayName: 'salesforcedx-vscode-apex-testing',
  // This package uses per-test-file mock functions with mockResolvedValue. With resetMocks=true those implementations
  // are wiped before each test, causing Thenable-based APIs (e.g. showInformationMessage) to return undefined.
  resetMocks: false,
  roots: ['<rootDir>/test'],
  // This package doesn't use dynamic imports, so it's safe
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }]
  }
};
