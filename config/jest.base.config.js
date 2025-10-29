/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/(unit|jest)/**/?(*.)+(spec|test).[t]s?(x)'],
  setupFilesAfterEnv: ['../../scripts/setup-jest.ts'],
  reporters: ['default', ['jest-junit', { outputName: 'junit-custom-unitTests.xml' }]],
  coverageReporters: ['lcov', 'text', 'json'],
  resetMocks: true,
  moduleNameMapper: {
    '^vscode$': '<rootDir>/../../scripts/setup-jest.ts'
  },
  // Ignore .vscode-test directories to prevent Haste module map conflicts
  modulePathIgnorePatterns: ['/.vscode-test/'],
  testPathIgnorePatterns: ['/.vscode-test/']
  // This collectCoverageFrom will show coverage for all files in a projects, but slows down calculating coverage results.
  // Can be a good tool for measuring coverage of the project as a whole locally, but shouldn't be committed at this time.
  // Off:
  // npm run test  1231.48s user 150.82s system 1092% cpu 2:06.55 total
  // On:
  // npm run test  2461.94s user 244.14s system 1210% cpu 3:43.47 total
  // collectCoverageFrom: ['src/**/*.ts']
};
