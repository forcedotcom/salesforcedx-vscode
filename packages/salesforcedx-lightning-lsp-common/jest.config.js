module.exports = {
  displayName: 'unit',
  rootDir: '.',
  transform: {
    '.ts': 'ts-jest'
  },
  testRegex: 'src/.*(\\.|/)(test|spec)\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFilesAfterEnv: ['<rootDir>/jest/matchers.ts', 'jest-extended', '<rootDir>/jest.setup.js'],
  testEnvironmentOptions: {
    url: 'http://localhost/'
  },
  moduleNameMapper: {
    '^vscode$': '<rootDir>/../../config/__mocks__/vscode.js'
    // '^tiny-jsonc$': '<rootDir>/__mocks__/tiny-jsonc.js'
  }
};
