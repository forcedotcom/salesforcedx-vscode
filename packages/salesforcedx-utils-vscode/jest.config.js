// eslint:disable-next-line:no-var-requires
const baseConfig = require('../../config/jest.base.config');

module.exports = Object.assign({}, baseConfig, {
  testMatch: ['**/(jest)/**/?(*.)+(spec|test).[t]s?(x)'],
  // o11yReporter.ts uses dynamic import() for ESM-only o11y_schema/sf_pdp
  transform: { '^.+\\.tsx?$': ['ts-jest', { isolatedModules: false }] }
});
