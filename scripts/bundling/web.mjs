import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const emptyPolyfillsPath = join(__dirname, 'empty-polyfills.js');
const processGlobalPath = join(__dirname, 'process-global.js');
const processPolyfillPath = join(__dirname, 'process-polyfill.js');
const bufferGlobalPath = join(__dirname, 'buffer-global.js');
// Enhanced plugin to transform body.pipe() to browser-compatible pipeTo with stream conversion
const pipeTransformPlugin = () => ({
  name: 'pipe-transform',
  setup(build) {
    build.onLoad({ filter: /\.js$/ }, async args => {
      const fs = await import('fs/promises');
      let contents = await fs.readFile(args.path, 'utf8');

      // Only transform if the file contains the problematic pattern
      if (contents.includes('.body.pipe(')) {
        console.log(`[pipe-transform] Transforming ${args.path}`);

        // Transform res.body.pipe(output) to browser-compatible version
        // This handles the stream type conversion needed for browser compatibility
        contents = contents.replace(
          /(\w+\.body)\.pipe\(([^)]+)\)/g,
          `await (async () => {
            const readableStream = $1;
            const nodeStream = $2;

            // Convert Node.js writable stream to Web WritableStream
            const webWritableStream = new WritableStream({
              write(chunk) {
                if (nodeStream.write) {
                  return new Promise((resolve, reject) => {
                    if (!nodeStream.write(chunk)) {
                      nodeStream.once('drain', resolve);
                    } else {
                      resolve();
                    }
                  });
                }
              },
              close() {
                return new Promise((resolve) => {
                  if (nodeStream.end) {
                    nodeStream.end(resolve);
                  } else {
                    resolve();
                  }
                });
              }
            });

            try {
              await readableStream.pipeTo(webWritableStream);
            } catch (error) {
              if (nodeStream.emit) {
                nodeStream.emit('error', error);
              }
            }
          })()`
        );

        return { contents };
      }

      // Return undefined to let esbuild handle the file normally
      return undefined;
    });
  }
});

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
  resolveExtensions: ['.js', '.ts', '.json'],
  inject: [processGlobalPath, processPolyfillPath, bufferGlobalPath],
  logOverride: {
    'unsupported-dynamic-import': 'error'
  },
  define: {
    'process.env.SF_DISABLE_LOG_FILE': "'true'",
    'process.env.FORCE_MEMFS': "'true'", // Added this line    // Ensure global is available for Node.js modules
    global: 'globalThis',
    // Other global polyfills
    __dirname: '""',
    __filename: '""'
  },
  alias: {
    // proper-lockfile and SDR use graceful-fs
    'graceful-fs': '@salesforce/core/fs',
    fs: '@salesforce/core/fs',
    'node:process': processPolyfillPath,
    'node:fs': '@salesforce/core/fs',
    'node:fs/promises': '@salesforce/core/fs',
    jsonwebtoken: 'jsonwebtoken-esm',
    // Redirect jsforce-node to browser-compatible jsforce.  This is important, it won't auth without it but I don't understand why.
    '@jsforce/jsforce-node': 'jsforce/browser',
    '@jsforce/jsforce-node/lib': 'jsforce/browser',
    // Force use of our custom process polyfill instead of esbuild's built-in
    process: processPolyfillPath,
    // Force all readable-stream imports to use the main one to avoid duplication
    'readable-stream': 'readable-stream', // Node.js built-in module polyfills
    'node:path': 'path-browserify',
    'node:os': 'os-browserify',
    'node:buffer': 'buffer',
    'node:stream': 'stream-browserify',
    'node:util': 'util',
    'node:events': 'events',
    events: 'events',
    'node:url': '/Users/shane.mclaughlin/eng/forcedotcom/salesforcedx-vscode/scripts/bundling/url-polyfill.js',
    'node:crypto': 'crypto-browserify',
    'node:http': 'stream-http',
    'node:https': 'https-browserify',
    'node:querystring': 'querystring-es3',
    'node:assert': 'assert',
    'node:path/posix': 'path-browserify',
    'node:assert/strict': 'assert',
    // Polyfills for jsforce-node dependencies
    'node-fetch': 'cross-fetch',
    'whatwg-url': 'url',
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
    url: '/Users/shane.mclaughlin/eng/forcedotcom/salesforcedx-vscode/scripts/bundling/url-polyfill.js',
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
    diagnostics_channel: 'diagnostics_channel'
  },
  plugins: [
    pipeTransformPlugin(),
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
