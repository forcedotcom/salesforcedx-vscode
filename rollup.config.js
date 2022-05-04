import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import dynamicImportVars from '@rollup/plugin-dynamic-import-vars';
import json from '@rollup/plugin-json';
import typescript from 'rollup-plugin-typescript2';

export default {
  input: './src/index.ts',
  output: {
    file: './out/src/index.js',
    format: 'cjs',
    sourcemap: false
  },
  external: [
    'vscode'
  ],
  plugins: [
    typescript({
      tsconfigOverride: { 
        compilerOptions: { 
          module: 'es2015',
      }, 
      verbosity: 3 
    },
  }),
  json(), // Process JSON imports
  dynamicImportVars({
    // Throw a warning on error and don't quit build
    warnOnError: true,
  }),
  nodeResolve(),
  commonjs(),
  ]
};