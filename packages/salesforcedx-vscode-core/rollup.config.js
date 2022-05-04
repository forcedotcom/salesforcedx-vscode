import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
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
    nodeResolve(),
    commonjs(),
    json(),
    typescript({
      tsconfigOverride: { 
        compilerOptions: { 
          module: 'es2015',
      }, 
      verbosity: 3 
    },
  })
  ]
};