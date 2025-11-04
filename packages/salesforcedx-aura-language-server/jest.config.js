module.exports = {
    displayName: 'unit',
    transform: {
        '.ts': 'ts-jest',
    },
    transformIgnorePatterns: [
        // Don't transform files from the common package - use compiled output instead
        '/node_modules/(?!(@salesforce/salesforcedx-lightning-lsp-common)/)',
    ],
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
        // Map relative imports from baseContext.js - these resolve from where baseContext.js is located
        // When baseContext.js does require("./resources/core/jsconfig-core.json"), it resolves from out/src/baseContext.js
        // We need to map these relative paths as Jest resolves them
        '^\\./resources/core/jsconfig-core\\.json$': '<rootDir>/../salesforcedx-lightning-lsp-common/out/src/resources/core/jsconfig-core.json',
        '^\\./resources/core/settings-core\\.json$': '<rootDir>/../salesforcedx-lightning-lsp-common/out/src/resources/core/settings-core.json',
        '^\\./resources/sfdx/jsconfig-sfdx\\.json$': '<rootDir>/../salesforcedx-lightning-lsp-common/out/src/resources/sfdx/jsconfig-sfdx.json',
        // Map tern plugin .js imports to .ts files for Jest (dynamic imports use .js but Jest needs .ts)
        '^\\./ternAura\\.js$': '<rootDir>/src/tern-server/ternAura',
        '^\\.\\./tern/plugin/modules\\.js$': '<rootDir>/src/tern/plugin/modules',
        '^\\.\\./tern/plugin/doc_comment\\.js$': '<rootDir>/src/tern/plugin/doc_comment',
        // Note: tern definition JSON imports are mocked explicitly in test files
        // Don't use moduleNameMapper here as it can interfere with jest.mock()
    },
    // Add common package's out/src to moduleDirectories so relative imports from baseContext.js resolve correctly
    moduleDirectories: ['<rootDir>/../salesforcedx-lightning-lsp-common/out/src', 'node_modules'],
};
