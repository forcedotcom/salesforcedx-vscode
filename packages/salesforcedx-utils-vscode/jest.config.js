// eslint:disable-next-line:no-var-requires
const baseConfig = require('../../config/jest.base.config');

module.exports = Object.assign({}, baseConfig, {
  testMatch: ['**/(jest)/**/?(*.)+(spec|test).[t]s?(x)'],
  // o11yReporter.ts uses dynamic import() of ESM-only o11y_schema/sf_pdp. Under isolatedModules:true,
  // ts-jest's transpileModule would keep node16's native import() (needs --experimental-vm-modules in jest).
  // Override module to CommonJS so import() downlevels to require() while keeping isolatedModules:true.
  transform: { '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true, tsconfig: { module: 'CommonJS' } }] }
});
