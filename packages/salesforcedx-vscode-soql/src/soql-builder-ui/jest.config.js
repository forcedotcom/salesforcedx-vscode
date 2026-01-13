/*
Running LWC in Jest requires specific configuration
that lwc-services provides, so we do not import the BASE config
like we do with the rest of the packages.
*/

const { jestConfig } = require('lwc-services/lib/config/jestConfig');

module.exports = {
  ...jestConfig,
  testMatch: ['**/*.+(spec|test).(ts|js)'],
  displayName: 'soql-builder-ui',
  verbose: true,
  setupFiles: ['<rootDir>/src/jestSetup/setupTests.ts']
};
