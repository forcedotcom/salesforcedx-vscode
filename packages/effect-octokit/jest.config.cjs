const baseConfig = require('../../config/jest.base.config');

module.exports = Object.assign({}, baseConfig, {
  // Wireit prepends node_modules/.bin, so `node` is the vendored Node 22 package.
  // Jest's require(ESM) needs SourceTextModule#hasAsyncGraph (Node 24.9+). Native ESM
  // with --experimental-vm-modules works on that Node 22 binary.
  extensionsToTreatAsEsm: ['.ts'],
  setupFilesAfterEnv: [],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: { module: 'nodenext', moduleResolution: 'nodenext', isolatedModules: true }
      }
    ]
  },
  moduleNameMapper: Object.assign({}, baseConfig.moduleNameMapper, { '^(\\.{1,2}/.*)\\.js$': '$1' })
});
