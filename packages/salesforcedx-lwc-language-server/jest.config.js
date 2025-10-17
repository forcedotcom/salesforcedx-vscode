module.exports = {
    displayName: 'unit',
    transform: {
        '.ts': 'ts-jest',
    },
    testRegex: 'src/.*(\\.|/)(test|spec)\\.(ts|js)$',
    testPathIgnorePatterns: ['/out/', '/lib/'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    setupFilesAfterEnv: ['<rootDir>/jest/matchers.ts', 'jest-extended', '<rootDir>/jest.setup.js'],
    testEnvironmentOptions: {
        url: 'http://localhost/',
    },
    moduleNameMapper: {
        '^vscode$': '<rootDir>/../../config/__mocks__/vscode.js',
        '^@salesforce/salesforcedx-lightning-lsp-common/(.*)$': '<rootDir>/../salesforcedx-lightning-lsp-common/$1',
    },
};
