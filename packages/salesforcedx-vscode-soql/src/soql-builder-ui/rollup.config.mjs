/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { copyFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import lwc from '@lwc/rollup-plugin';
import alias from '@rollup/plugin-alias';
import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import inject from '@rollup/plugin-inject';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * antlr4ts (used by soql-model for SOQL parsing) imports the Node.js 'assert'
 * and 'util' built-ins. These don't exist in browsers. Rather than pulling in
 * the heavy npm polyfill packages (which transitively depend on call-bind and
 * get-proto, both of which have browser:null/conditional-exports that confuse
 * @rollup/plugin-node-resolve), we inline minimal browser shims that cover
 * exactly what antlr4ts needs at runtime.
 */
const nodeShims = {
  name: 'node-shims',
  resolveId(id) {
    if (id === 'assert' || id === 'util') return `\0node-shim:${id}`;
    return null;
  },
  load(id) {
    if (id === '\0node-shim:assert') {
      return `
function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}
assert.ok = assert;
assert.equal = (a, b, msg) => { if (a != b) throw new Error(msg || a + ' != ' + b); };
assert.strictEqual = (a, b, msg) => { if (a !== b) throw new Error(msg || a + ' !== ' + b); };
assert.notStrictEqual = (a, b, msg) => { if (a === b) throw new Error(msg); };
assert.deepEqual = () => {};
assert.deepStrictEqual = () => {};
export { assert as default, assert as ok, assert as equal, assert as strictEqual };
`;
    }
    if (id === '\0node-shim:util') {
      return `
// antlr4ts only uses util.inspect.custom (a Symbol for custom inspection)
export const inspect = { custom: Symbol.for('nodejs.util.inspect.custom') };
export function inherits(ctor, superCtor) {
  ctor.super_ = superCtor;
  Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
}
const util = { inspect, inherits };
export default util;
`;
    }
    return null;
  }
};

/**
 * @lwc/rollup-plugin returns an empty string '' for the virtual CSS module
 * @lwc/resources/empty_css.css that the LWC compiler inserts for components
 * with no CSS file. Rollup v4 enforces that `import default from '…'` requires
 * an actual export, so an empty module causes a hard error. This plugin claims
 * the ID first and returns a module that exports `undefined` as its default.
 */
const fixLwcEmptyCss = {
  name: 'fix-lwc-empty-css',
  load(id) {
    if (id.endsWith('@lwc/resources/empty_css.css')) {
      return 'export default undefined;';
    }
  }
};

/** Copies index.html to dist/ after the bundle is written. */
const copyHtml = {
  name: 'copy-html',
  writeBundle() {
    mkdirSync('dist', { recursive: true });
    copyFileSync('index.html', 'dist/index.html');
  }
};

export default {
  input: 'index.ts',
  plugins: [
    nodeShims,
    alias({
      entries: [
        { find: 'os', replacement: 'os-browserify/browser' },
        {
          find: '@salesforce/soql-model',
          replacement: path.resolve(__dirname, '../soql-model')
        }
      ]
    }),
    fixLwcEmptyCss,
    // Strips TypeScript types from ALL .ts files in the bundle using Babel.
    //
    // We use Babel (not @rollup/plugin-typescript) here because:
    //   1. @lwc/compiler v9 dropped @babel/preset-typescript, so LWC component
    //      files must have types stripped before the LWC plugin sees them.
    //   2. @rollup/plugin-typescript only covers files under CWD via its
    //      default include, and the aliased ../soql-model/ sibling package falls
    //      outside that scope, causing raw-TypeScript parse failures.
    //
    // Babel does purely syntactic type erasure (no cross-file type checking),
    // which is fine here — we're only building, not type-checking. Type-only
    // re-exports must use `export type { … }` in source so that Babel correctly
    // identifies and removes them (the one instance in toolingModelService.ts
    // was fixed to use `export type { ToolingModelJson }`).
    //
    // @babel/plugin-syntax-decorators enables parsing of @api/@track without
    // transforming them — the LWC compiler's Babel pipeline handles that.
    babel({
      extensions: ['.ts'],
      babelHelpers: 'bundled',
      plugins: [
        ['@babel/plugin-syntax-decorators', { version: 'legacy' }]
      ],
      presets: [['@babel/preset-typescript', { allExtensions: true }]]
    }),
    lwc({
      modules: [{ dir: 'modules' }],
      // Restrict LWC compiler to component files only; without this it also
      // tries to apply its own Babel transform to soql-model .ts files.
      include: ['modules/**']
    }),
    resolve({ browser: true, extensions: ['.ts', '.mjs', '.js', '.json'] }),
    commonjs(),
    inject({
      process: 'process/browser'
    }),
    terser({ format: { comments: false }, maxWorkers: 1 }),
    copyHtml
  ],
  output: {
    file: 'dist/app.js',
    format: 'iife',
    name: 'SoqlBuilderUI'
  }
};
