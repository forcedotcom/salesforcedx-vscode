'use strict';

const path = require('path');
const ts = require('typescript');
const { createTransformer } = require('ts-jest').default;

const tsJest = createTransformer({ isolatedModules: true });

const isServicesLayers = sourcePath => path.basename(sourcePath) === 'servicesLayers.ts';

/**
 * Downlevel servicesLayers.ts `import()` to `require` so Jest's vm can load it. File-only CommonJS emit.
 */
module.exports = {
  process(sourceText, sourcePath, options) {
    if (isServicesLayers(sourcePath)) {
      return {
        code: ts.transpileModule(sourceText, {
          fileName: sourcePath,
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            esModuleInterop: true
          }
        }).outputText
      };
    }
    return tsJest.process(sourceText, sourcePath, options);
  },
  getCacheKey(sourceText, sourcePath, options) {
    const base = tsJest.getCacheKey(sourceText, sourcePath, options);
    return isServicesLayers(sourcePath) ? `${base}:cjs-dynamic-import` : base;
  }
};
