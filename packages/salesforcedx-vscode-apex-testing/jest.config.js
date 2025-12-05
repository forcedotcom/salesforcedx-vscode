const baseConfig = require('../../config/jest.base.config.js');

module.exports = {
  ...baseConfig,
  displayName: 'salesforcedx-vscode-apex-testing',
  roots: ['<rootDir>/test']
};
