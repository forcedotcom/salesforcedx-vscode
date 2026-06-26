// Pin timezone so date-formatting tests (toDateString/toLocaleTimeString in
// src/utils/dateUtil.ts, junitReporter) and their snapshots are deterministic
// across machines/CI. Set before any Date is constructed.
process.env.TZ = 'UTC';

// eslint:disable-next-line:no-var-requires
const baseConfig = require('../../config/jest.base.config');

module.exports = Object.assign({}, baseConfig, {
  // upstream suite lives under test/** (not unit|jest dirs), so override testMatch
  testMatch: ['**/test/**/?(*.)+(spec|test).[t]s?(x)'],
  // run before the test framework: ensure the @salesforce/core TestContext alias
  // file exists so AliasAccessor.init does not throw ENOENT under jest.
  setupFiles: ['<rootDir>/test/jest.setup.ts'],
  // const enums in src/tests/types.ts need real emission for cross-pkg consumers;
  // ts-jest isolatedModules:true (base) strips them, so override to false here.
  // 151002: ts-jest warns hybrid module (node16) prefers isolatedModules:true; we
  // intentionally use false for const-enum emission, so ignore that diagnostic.
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        isolatedModules: false,
        diagnostics: { ignoreCodes: [151002] },
        // pin to test/tsconfig.json (bundler resolution) so @salesforce/core/testSetup
        // resolves deterministically across parallel workers (node16 subpath type
        // resolution races on cold cache).
        tsconfig: '<rootDir>/test/tsconfig.json'
      }
    ]
  },
  // resetMocks=true (base) wipes the node:os homedir mock from setup-jest before each
  // test, leaving @salesforce/core Logger's SF_DIR (path.join(os.homedir(), ...)) undefined.
  // Per-test isolation here comes from sinon sandbox restore / jest.restoreAllMocks, not auto-reset.
  resetMocks: false
});
