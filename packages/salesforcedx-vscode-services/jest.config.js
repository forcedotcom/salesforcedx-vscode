// eslint:disable-next-line:no-var-requires
const baseConfig = require('../../config/jest.base.config');

module.exports = Object.assign({}, baseConfig, {
  // o11ySpanExporter.ts uses dynamic import() for ESM-only o11y_schema/sf_pdp.
  // Force module: commonjs (the repo tsconfig is node16) so ts-jest rewrites import() to require,
  // letting the o11y_schema/sf_pdp moduleNameMapper mock apply under Jest's CJS VM.
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: false, tsconfig: { module: 'commonjs' } }]
  }
});
