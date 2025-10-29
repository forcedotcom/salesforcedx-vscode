module.exports = {
    displayName: 'unit',
    transform: {
        '.ts': 'ts-jest',
    },
    testRegex: 'src/.*(\\.|/)(test|spec)\\.(ts|js)$',
    testPathIgnorePatterns: ['/out/', '/lib/'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    setupFilesAfterEnv: ['jest-extended', '<rootDir>/jest.setup.js'],
    testEnvironmentOptions: {
        url: 'http://localhost/',
    },
    moduleNameMapper: {
        '^vscode$': '<rootDir>/../../config/__mocks__/vscode.js',
        '^@salesforce/salesforcedx-lightning-lsp-common/testUtils$': '<rootDir>/../salesforcedx-lightning-lsp-common/out/src/__tests__/testUtils',
        '^@salesforce/salesforcedx-lightning-lsp-common/providers/fileSystemDataProvider$':
            '<rootDir>/../salesforcedx-lightning-lsp-common/out/src/providers/fileSystemDataProvider',
        '^@salesforce/salesforcedx-lightning-lsp-common$': '<rootDir>/../salesforcedx-lightning-lsp-common/out/src/index',
    },
};
