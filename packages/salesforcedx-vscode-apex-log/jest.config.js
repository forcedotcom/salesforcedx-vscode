/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  ...require('../../config/jest.base.config.js'),
  displayName: 'salesforcedx-vscode-apex-log',
  moduleNameMapper: {
    ...require('../../config/jest.base.config.js').moduleNameMapper,
    // Map .js imports to .ts files for Jest
    '^(\\.{1,2}/.*)\\.js$': '$1'
  }
};
