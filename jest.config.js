/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  rootDir: 'scripts',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/**/*.test.ts'],
  transform: {
    '^.+\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }]
  }
};
