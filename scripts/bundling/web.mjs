import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const emptyPolyfillsPath = join(__dirname, 'empty-polyfills.js');
const processGlobalPath = join(__dirname, 'process-global.js');
const processPolyfillPath = join(__dirname, 'process-polyfill.js');
const bufferGlobalPath = join(__dirname, 'buffer-global.js');
const fsPolyfillPath = join(__dirname, 'fs-polyfill.js');

export const commonConfigBrowser = {
  mainFields: ['browser', 'module', 'main'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  external: ['vscode'],
  // TODO: we need a way to turn this off for debugging and local dev
  minify: true,
  sourcemap: true,
  keepNames: true,
  resolveExtensions: ['.js', '.ts', '.json'],
  inject: [processGlobalPath, bufferGlobalPath],
  logOverride: {
    'unsupported-dynamic-import': 'error'
  },
  define: {
    'process.env.SF_DISABLE_LOG_FILE': "'true'",
    'process.env.FORCE_MEMFS': "'true'", // Added this line    // Ensure global is available for Node.js modules
    global: 'globalThis'
    // Other global polyfills
  },
  alias: {
    // proper-lockfile and SDR use graceful-fs
    'graceful-fs': fsPolyfillPath,
    fs: fsPolyfillPath,
    'node:fs': fsPolyfillPath,
    'node:fs/promises': fsPolyfillPath,
    jsonwebtoken: 'jsonwebtoken-esm',
    // Redirect jsforce-node to browser-compatible jsforce.  This is important, it won't auth without it but I don't understand why.
    '@jsforce/jsforce-node': 'jsforce/browser',
    '@jsforce/jsforce-node/lib': 'jsforce/browser',
    // Force use of our custom process polyfill instead of esbuild's built-in
    process: processPolyfillPath,
    // Force all readable-stream imports to use the main one to avoid duplication
    'readable-stream': 'readable-stream',
    events: 'events', // Node.js built-in module polyfills
    'node:path': 'path-browserify',
    'node:http': 'stream-http',
    'node:https': 'https-browserify',
    'node:os': 'os-browserify',
    'node:buffer': 'buffer',
    'node:stream': 'readable-stream',
    'node:util': 'util',
    'node:events': 'events',

    'node:url': '/Users/shane.mclaughlin/eng/forcedotcom/salesforcedx-vscode/scripts/bundling/url-polyfill.js',
    'node:crypto': 'crypto-browserify',
    'node:querystring': 'querystring-es3',
    'node:assert': 'assert',
    'node:path/posix': 'path-browserify',
    'node:assert/strict': 'assert',
    // Polyfills for jsforce-node dependencies
    // Empty polyfills for modules that can't be polyfilled
    'node:net': emptyPolyfillsPath,
    got: emptyPolyfillsPath, // has a lot of very node-focused references in its dependencies.
    // Standard Node.js modules (without node: prefix)
    path: 'path-browserify',
    os: 'os-browserify',
    buffer: 'buffer',
    stream: 'readable-stream',
    util: 'util',
    url: '/Users/shane.mclaughlin/eng/forcedotcom/salesforcedx-vscode/scripts/bundling/url-polyfill.js',
    crypto: 'crypto-browserify',
    http: 'stream-http',
    https: 'https-browserify',
    querystring: 'querystring-es3',
    assert: 'assert',
    zlib: 'browserify-zlib',
    timers: 'timers-browserify'
  },
  plugins: [
    nodeModulesPolyfillPlugin({
      modules: {
        // Empty polyfills for modules that can't be polyfilled
        child_process: 'empty',
        dns: 'empty',
        net: 'empty',
        tls: 'empty',
        http2: 'empty'
      },
      globals: {
        process: false,
        Buffer: false
      }
    })
  ]
};
