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
    '^querybuilder/(\\w+)$': '<rootDir>/modules/querybuilder/$1/$1'
  }
};
