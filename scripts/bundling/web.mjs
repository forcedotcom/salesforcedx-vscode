import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const emptyPolyfillsPath = join(__dirname, 'empty-polyfills.js');
const processGlobalPath = join(__dirname, 'process-global.js');
const bufferGlobalPath = join(__dirname, 'buffer-global.js');

export const commonConfigBrowser = {
  mainFields: ['browser', 'module', 'main'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  external: ['vscode'],
  // TODO: we need a way to turn this off for debugging and local dev
  minify: false,
  sourcemap: true,
  keepNames: true,
  logOverride: {
    'unsupported-dynamic-import': 'error'
  },
  inject: [processGlobalPath, bufferGlobalPath],
  define: {
    // this prevents the logger from writing to any files, obviating the need for pino-bundling stuff
    'process.env.SF_DISABLE_LOG_FILE': "'true'",
    // Ensure global is available for Node.js modules
    global: 'globalThis',
    // Other global polyfills
    __dirname: '""',
    __filename: '""'
  },
  alias: {
    // proper-lockfile and SDR use graceful-fs
    'graceful-fs': '@salesforce/core/fs',
    jsonwebtoken: 'jsonwebtoken-esm',
    // Node.js built-in module polyfills
    'node:path': 'path-browserify',
    'node:os': 'os-browserify',
    'node:buffer': 'buffer',
    'node:stream': 'stream-browserify',
    'node:util': 'util',
    'node:events': 'events',
    'node:url': 'url',
    'node:crypto': 'crypto-browserify',
    'node:http': 'stream-http',
    'node:https': 'https-browserify',
    'node:querystring': 'querystring-es3',
    'node:assert': 'assert',
    'node:path/posix': 'path-browserify',
    'node:assert/strict': 'assert',
    // Empty polyfills for modules that can't be polyfilled
    'node:child_process': emptyPolyfillsPath,
    'node:dns': emptyPolyfillsPath,
    'node:net': emptyPolyfillsPath,
    'node:tls': emptyPolyfillsPath,
    'node:http2': emptyPolyfillsPath,
    // Standard Node.js modules (without node: prefix)
    path: 'path-browserify',
    os: 'os-browserify',
    buffer: 'buffer',
    stream: 'stream-browserify',
    util: 'util',
    events: 'events',
    url: 'url',
    crypto: 'crypto-browserify',
    http: 'stream-http',
    https: 'https-browserify',
    querystring: 'querystring-es3',
    assert: 'assert',
    zlib: 'browserify-zlib',
    timers: 'timers-browserify',
    tty: 'tty-browserify',
    string_decoder: 'string_decoder',
    punycode: 'punycode',
    domain: 'domain-browser',
    constants: 'constants-browserify',
    console: 'console-browserify',
    vm: 'vm-browserify',
    diagnostics_channel: 'diagnostics_channel',
    // Empty polyfills for modules that can't be polyfilled
    child_process: emptyPolyfillsPath,
    dns: emptyPolyfillsPath,
    net: emptyPolyfillsPath,
    tls: emptyPolyfillsPath,
    http2: emptyPolyfillsPath
  },
  plugins: [nodeModulesPolyfillPlugin()]
};
