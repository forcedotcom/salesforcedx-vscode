module.exports = {
  displayName: 'unit',
  transform: {
    '.ts': 'ts-jest'
  },
  testRegex: 'src/.*(\\.|/)(test|spec)\\.(ts|js)$',
  // Use regex patterns that match both forward slashes and backslashes for cross-platform compatibility
  testPathIgnorePatterns: ['[/\\\\]out[/\\\\]', '[/\\\\]lib[/\\\\]'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFilesAfterEnv: ['<rootDir>/jest/matchers.ts', 'jest-extended'],
  testEnvironmentOptions: {
    url: 'http://localhost/'
  },
  moduleNameMapper: {
    '^vscode$': '<rootDir>/../../config/__mocks__/vscode.js',
    '^tiny-jsonc$': '<rootDir>/../salesforcedx-lightning-lsp-common/__mocks__/tiny-jsonc.js',
    '^@salesforce/salesforcedx-lightning-lsp-common/testUtils$':
      '<rootDir>/../salesforcedx-lightning-lsp-common/out/src/__tests__/testUtils',
    '^@salesforce/salesforcedx-lightning-lsp-common/providers/fileSystemDataProvider$':
      '<rootDir>/../salesforcedx-lightning-lsp-common/out/src/providers/fileSystemDataProvider',
    '^@salesforce/salesforcedx-lightning-lsp-common/resources/sfdx/tsconfig-sfdx.base.json$':
      '<rootDir>/../salesforcedx-lightning-lsp-common/out/src/resources/sfdx/tsconfig-sfdx.base.json',
    '^@salesforce/salesforcedx-lightning-lsp-common/resources/sfdx/tsconfig-sfdx.json$':
      '<rootDir>/../salesforcedx-lightning-lsp-common/out/src/resources/sfdx/tsconfig-sfdx.json',
    '^@salesforce/salesforcedx-lightning-lsp-common$': '<rootDir>/../salesforcedx-lightning-lsp-common/out/src/index'
  },
  // Add common package's out/src to moduleDirectories so relative imports from baseContext.js resolve correctly
  // This allows Jest to find JSON files when baseContext.js does require("./resources/...")
  moduleDirectories: ['<rootDir>/../salesforcedx-lightning-lsp-common/out/src', 'node_modules']
};
