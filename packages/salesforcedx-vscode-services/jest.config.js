// eslint:disable-next-line:no-var-requires
const baseConfig = require('../../config/jest.base.config');

module.exports = Object.assign({}, baseConfig, {
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    // SDR has no `exports` field, so ts-jest cannot resolve its JSON subpaths
    // at runtime. Map the import directly to the file on disk.
    '^@salesforce/source-deploy-retrieve/lib/src/registry/stdValueSetRegistry\\.json$':
      '<rootDir>/../../node_modules/@salesforce/source-deploy-retrieve/lib/src/registry/stdValueSetRegistry.json'
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true, tsconfig: 'test/tsconfig.json' }]
  }
});
