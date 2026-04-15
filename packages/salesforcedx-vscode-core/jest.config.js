//eslint:disable-next-line:no-var-requires
const baseConfig = require('../../config/jest.base.config');

module.exports = Object.assign({}, baseConfig, {
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    '^@salesforce/source-tracking$': '<rootDir>/test/jest/mock-source-tracking.ts'
  }
});
