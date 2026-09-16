// eslint:disable-next-line:no-var-requires
const baseConfig = require('../../config/jest.base.config');

module.exports = Object.assign({}, baseConfig, {
  // servicesLayers.ts `import()` — Jest vm cannot run it. transformer.cjs downlevels that file; map specifier to .ts
  transform: { '^.+\\.tsx?$': ['<rootDir>/jest.transformer.cjs'] },
  moduleNameMapper: Object.assign({}, baseConfig.moduleNameMapper, {
    '^\\./terminal/crossSpawnCommandExecutor\\.js$': '<rootDir>/src/terminal/crossSpawnCommandExecutor.ts'
  })
});
