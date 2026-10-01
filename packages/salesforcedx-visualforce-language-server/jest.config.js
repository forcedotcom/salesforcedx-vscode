const baseConfig = require('../../config/jest.base.config');

module.exports = Object.assign({}, baseConfig, {
  // languageModes.ts uses `await import('./javascriptMode.js')` (build-time-gated lazy load). Under the
  // project's module:node16 tsconfig, ts-jest preserves native `import()` which jest's vm can't run without
  // --experimental-vm-modules. Override module:commonjs so the dynamic import downlevels to require; keep the
  // faster isolatedModules:true default (base config notes it's 4-7x faster).
  transform: { '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true, tsconfig: { module: 'commonjs' } }] },
  // Strip the ESM `.js` extension from relative dynamic imports so jest resolves the `.ts` source.
  moduleNameMapper: Object.assign({}, baseConfig.moduleNameMapper, { '^(\\.{1,2}/.*)\\.js$': '$1' })
});
