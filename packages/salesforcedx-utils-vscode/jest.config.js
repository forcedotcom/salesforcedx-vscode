// eslint:disable-next-line:no-var-requires
const baseConfig = require('../../config/jest.base.config');

module.exports = Object.assign({}, baseConfig, {
  testMatch: ['**/(jest)/**/?(*.)+(spec|test).[t]s?(x)']
});
