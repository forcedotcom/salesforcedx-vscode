/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/(unit|jest)/**/?(*.)+(spec|test).[t]s?(x)'],
  setupFilesAfterEnv: ['../../scripts/setup-jest.ts'],
  reporters: [
    'default',
    ['jest-junit', { outputName: 'junit-custom-unitTests.xml' }]
  ],
  coverageReporters: ['lcov', 'text'],
  resetMocks: true
};
