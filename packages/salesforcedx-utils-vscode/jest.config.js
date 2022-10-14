const baseConfig = require('../../config/jest.base.config');

module.exports = Object.assign({}, baseConfig, {
  testMatch: ['**/unit/**/?(*.)+(spec|test).[t]s?(x)']
});
