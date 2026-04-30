// eslint:disable-next-line:no-var-requires
const baseConfig = require('../../config/jest.base.config');

module.exports = Object.assign({}, baseConfig, {
  // Disable Prettier for inline snapshots (Prettier 3+ incompatible with jest-snapshot)
  prettierPath: null,
  // orgUtil.ts uses `await import('@salesforce/core')` which requires --experimental-vm-modules
  transform: { '^.+\\.tsx?$': ['ts-jest', { isolatedModules: false }] }
});
