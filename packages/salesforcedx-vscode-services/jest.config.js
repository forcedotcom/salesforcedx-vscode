// eslint:disable-next-line:no-var-requires
const baseConfig = require('../../config/jest.base.config');

module.exports = Object.assign({}, baseConfig, {
  // terminalService.ts uses `await import('node:child_process')`. Under module:node16 ts-jest keeps
  // import() native, so jest.mock can't intercept it (and jsdom/vm rejects it without
  // --experimental-vm-modules). Downleveling to commonjs makes ts-jest emit require, so mocks apply.
  transform: { '^.+\\.tsx?$': ['ts-jest', { isolatedModules: false, tsconfig: { module: 'commonjs' } }] }
});
