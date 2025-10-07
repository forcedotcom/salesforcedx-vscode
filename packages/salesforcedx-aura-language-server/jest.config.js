module.exports = {
    displayName: 'unit',
    transform: {
        '.ts': 'ts-jest',
    },
    testRegex: 'src/.*(\\.|/)(test|spec)\\.(ts|js)$',
    moduleFileExtensions: ['ts', 'js', 'json'],
    setupFilesAfterEnv: ['jest-extended', '<rootDir>/jest.setup.js'],
    testEnvironmentOptions: {
        url: 'http://localhost/',
    },
};
