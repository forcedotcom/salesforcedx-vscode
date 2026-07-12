const baseConfig = require('../../config/jest.base.config');

module.exports = Object.assign({}, baseConfig, {
  // languageModes.ts uses `await import('./javascriptMode.js')` (build-time-gated lazy load). Under the
  // project's module:node16 tsconfig, ts-jest preserves native `import()` which jest's vm can't run without
  // --experimental-vm-modules. Override to commonjs (isolatedModules:false) so the dynamic import downlevels to require.
  transform: { '^.+\\.tsx?$': ['ts-jest', { isolatedModules: false, tsconfig: { module: 'commonjs' } }] },
  // Strip the ESM `.js` extension from relative dynamic imports so jest resolves the `.ts` source.
  moduleNameMapper: Object.assign({}, baseConfig.moduleNameMapper, { '^(\\.{1,2}/.*)\\.js$': '$1' })
});
