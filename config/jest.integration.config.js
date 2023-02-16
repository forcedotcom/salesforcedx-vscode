/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/integration/**/?(*.)+(spec|test).[t]s?(x)'],
  setupFilesAfterEnv: ['../../scripts/setup-jest.ts'],
  reporters: [
    'default',
    ['jest-junit', { outputName: 'junit-custom-integrationTests.xml' }]
  ],
  coverageReporters: ['lcov', 'text'],
  resetMocks: true
};
