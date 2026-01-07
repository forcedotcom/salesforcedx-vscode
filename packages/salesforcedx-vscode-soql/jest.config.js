// eslint:disable-next-line:no-var-requires
const baseConfig = require('../../config/jest.base.config');

module.exports = {
  ...baseConfig,
  testMatch: [...baseConfig.testMatch, '<rootDir>/out/soql-common/**/*.test.js']
};
