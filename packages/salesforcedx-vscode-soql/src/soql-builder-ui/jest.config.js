/*
 * Uses @lwc/jest-preset directly, replacing the lwc-services wrapper.
 * lwc-services was a thin wrapper around @lwc/jest-preset with a custom module
 * resolver that resolved LWC module paths (e.g. 'querybuilder/app') to files
 * on disk. We replicate that resolution here via moduleNameMapper.
 */
const lwcPreset = require('@lwc/jest-preset');

module.exports = {
  ...lwcPreset,
  roots: ['<rootDir>/../../test/jest/soql-builder-ui'],
  testMatch: ['**/*.+(spec|test).(ts|js)'],
  displayName: 'soql-builder-ui',
  verbose: true,
  setupFiles: ['<rootDir>/jestSetup/setupTests.ts'],
  moduleNameMapper: {
    // Resolve LWC module paths (e.g. 'querybuilder/app' → modules/querybuilder/app/app)
    '^querybuilder/(\\w+)$': '<rootDir>/modules/querybuilder/$1/$1',
    // Map @salesforce/soql-model to the local sibling package (same as Rollup alias)
    '^@salesforce/soql-model/(.*)$': '<rootDir>/../../src/soql-model/$1'
  },
  // @lwc/engine-dom@9+ and @lwc/synthetic-shadow@9+ are published as ESM.
  // Allow @lwc/jest-transformer to process them so Jest (CJS mode) can load them.
  transformIgnorePatterns: ['/node_modules/(?!@lwc/)']
};
