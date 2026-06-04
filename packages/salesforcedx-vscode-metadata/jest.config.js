// eslint:disable-next-line:no-var-requires
const baseConfig = require('../../config/jest.base.config');

module.exports = Object.assign({}, baseConfig, {
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    // The services package's root entry runs heavy startup side effects (observability, tracing).
    // Tests only need HashableUri at runtime; all other root imports are type-only and erased.
    // Map the bare-root specifier to the self-contained hashableUri module.
    '^salesforcedx-vscode-services$': '<rootDir>/../salesforcedx-vscode-services/src/vscode/hashableUri.ts'
  }
});
