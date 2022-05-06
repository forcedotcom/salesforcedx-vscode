#!/usr/bin/env node

const esbuild = require('esbuild');
const {filelocPlugin} = require('esbuild-plugin-fileloc')
const path = require('path');
const cwd = process.cwd();

esbuild.build({
  entryPoints: [path.join(cwd, 'out/src/index.js')],
  bundle: true,
  outfile: path.join(cwd, 'out/src/bundle.js'),
  format: 'cjs', 
  platform: 'node',
  mainFields: ['module','main'],
  external: ['vscode'],
  logLevel: 'info',
  plugins: [
    filelocPlugin()
  ]
});
