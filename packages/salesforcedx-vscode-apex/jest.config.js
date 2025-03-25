const baseConfig = require('../../config/jest.base.config');

module.exports = Object.assign({}, baseConfig, {
  moduleNameMapper: {
    '^vscode$': '<rootDir>/test/jest/__mocks__/vscode.ts'
  },
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testPathIgnorePatterns: ['/node_modules/', '/out/']
});
