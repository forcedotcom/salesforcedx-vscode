// eslint:disable-next-line:no-var-requires
const baseConfig = require('../../config/jest.base.config');

module.exports = {
  ...baseConfig,
  displayName: 'org-browser-ui',
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/test/jest/org-browser-ui/**/*.test.ts?(x)'],
  setupFilesAfterEnv: [...baseConfig.setupFilesAfterEnv, '<rootDir>/test/jest/org-browser-ui/setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/src/org-browser-ui/tsconfig.json' }]
  }
};
