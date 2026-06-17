// eslint:disable-next-line:no-var-requires
const baseConfig = require('../../config/jest.base.config');

module.exports = Object.assign({}, baseConfig, {
  testPathIgnorePatterns: [...(baseConfig.testPathIgnorePatterns || []), '/test/jest/soql-builder-ui/'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }]
  }
});
