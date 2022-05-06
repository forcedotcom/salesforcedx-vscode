import commonjs from '@rollup/plugin-commonjs';
import dynamicImportVars from '@rollup/plugin-dynamic-import-vars';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';

export default {
  input: './src/index.ts',
  output: {
    file: './out/src/bundle.js',
    format: 'cjs',
    sourcemap: false
  },
  external: [
    'vscode'
  ],
  plugins: [
    nodeResolve({
      "preferBuiltins": false
    }),
    commonjs(),
    json(), // Process JSON imports
    typescript({
      tsconfigOverride: { 
        compilerOptions: { 
          module: 'es2015',
        }, 
        verbosity: 3 
      },
    }),
    // As final step process dynamic 'require's e.g. i18n in messages
    dynamicImportVars({ 
      // Throw a warning on error and don't quit build (from error within node_modules etc. Excluding node_modules doesn't work)
      warnOnError: true,
    }),
  ]
};