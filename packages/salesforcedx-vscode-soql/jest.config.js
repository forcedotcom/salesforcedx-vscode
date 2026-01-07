// eslint:disable-next-line:no-var-requires
const baseConfig = require('../../config/jest.base.config');

module.exports = {
  ...baseConfig,
  testMatch: ['<rootDir>/out/test/jest/**/*.test.js', '<rootDir>/out/soql-common/src/**/*.test.js']
};
