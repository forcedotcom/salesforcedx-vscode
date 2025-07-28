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

// EventEmitter polyfill plugin to fix removeAllListeners issues after build
const eventEmitterPolyfillPlugin = () => ({
  name: 'eventemitter-polyfill',
  setup(build) {
    build.onEnd(async result => {
      if (result.errors.length > 0) return;

      // Process the actual output file on disk
      const fs = await import('fs/promises');
      const path = await import('path');
      const outputPath = build.initialOptions.outfile;

      if (outputPath) {
        try {
          console.log(`[eventemitter-polyfill] Post-processing ${outputPath}...`);
          let contents = await fs.readFile(outputPath, 'utf8');

          if (contents.includes('noop')) {
            console.log(`[eventemitter-polyfill] Fixing EventEmitter noop assignments in ${outputPath}`);

            let fixedContents = contents;

            // Fix removeAllListeners (including minified noop patterns like p$1)
            fixedContents = fixedContents.replace(
              /(\w+)\.removeAllListeners\s*=\s*(noop\d*|p\$\d+)/g,
              `$1.removeAllListeners = function(type) {
                if (!this._events) this._events = {};
                if (type !== undefined) {
                  delete this._events[type];
                } else {
                  this._events = {};
                }
                return this;
              }`
            );

            // Fix listeners property - THIS IS THE KEY FIX!
            fixedContents = fixedContents.replace(
              /(\w+)\.listeners\s*=\s*(noop\d*|p\$\d+)/g,
              `$1.listeners = function(type) {
                if (!this._events) this._events = {};
                return this._events[type] ? [...this._events[type]] : [];
              }`
            );

            // Fix other common EventEmitter methods (including minified patterns)
            fixedContents = fixedContents.replace(
              /(\w+)\.on\s*=\s*(noop\d*|p\$\d+)/g,
              `$1.on = function(type, listener) {
                if (!this._events) this._events = {};
                if (!this._events[type]) this._events[type] = [];
                this._events[type].push(listener);
                return this;
              }`
            );

            fixedContents = fixedContents.replace(
              /(\w+)\.emit\s*=\s*(noop\d*|p\$\d+)/g,
              `$1.emit = function(type, ...args) {
                if (!this._events || !this._events[type]) return false;
                this._events[type].forEach(listener => listener.apply(this, args));
                return true;
              }`
            );

            // Fix addListener and prependListener patterns
            fixedContents = fixedContents.replace(
              /(\w+)\.addListener\s*=\s*(noop\d*|p\$\d+)/g,
              `$1.addListener = function(type, listener) {
                if (!this._events) this._events = {};
                if (!this._events[type]) this._events[type] = [];
                this._events[type].push(listener);
                return this;
              }`
            );

            fixedContents = fixedContents.replace(
              /(\w+)\.prependListener\s*=\s*(noop\d*|p\$\d+)/g,
              `$1.prependListener = function(type, listener) {
                if (!this._events) this._events = {};
                if (!this._events[type]) this._events[type] = [];
                this._events[type].unshift(listener);
                return this;
              }`
            );

            fixedContents = fixedContents.replace(
              /(\w+)\.prependOnceListener\s*=\s*(noop\d*|p\$\d+)/g,
              `$1.prependOnceListener = function(type, listener) {
                const wrapper = (...args) => {
                  this.removeListener(type, wrapper);
                  listener.apply(this, args);
                };
                return this.prependListener(type, wrapper);
              }`
            );

            // Add runtime polyfill for any EventEmitter instances created dynamically
            const runtimePolyfill = `
// Runtime EventEmitter polyfill - catches instances created after build
(function() {
  const originalEventEmitter = globalThis.EventEmitter;
  if (originalEventEmitter) {
    const originalPrototype = originalEventEmitter.prototype;

    // Ensure all EventEmitter instances have proper methods
    if (!originalPrototype.removeAllListeners || originalPrototype.removeAllListeners.toString().includes('noop')) {
      originalPrototype.removeAllListeners = function(type) {
        if (!this._events) this._events = {};
        if (type !== undefined) {
          delete this._events[type];
        } else {
          this._events = {};
        }
        return this;
      };
    }

    if (!originalPrototype.listeners || originalPrototype.listeners.toString().includes('noop')) {
      originalPrototype.listeners = function(type) {
        if (!this._events) this._events = {};
        return this._events[type] ? [...this._events[type]] : [];
      };
    }
  }

  // Also patch any existing EventEmitter-like objects
  if (typeof window !== 'undefined') {
    const patchEventEmitter = (obj) => {
      if (obj && typeof obj === 'object' && obj._events !== undefined) {
        if (!obj.removeAllListeners || obj.removeAllListeners.toString().includes('noop')) {
          obj.removeAllListeners = function(type) {
            if (!this._events) this._events = {};
            if (type !== undefined) {
              delete this._events[type];
            } else {
              this._events = {};
            }
            return this;
          };
        }

        if (!obj.listeners || obj.listeners.toString().includes('noop')) {
          obj.listeners = function(type) {
            if (!this._events) this._events = {};
            return this._events[type] ? [...this._events[type]] : [];
          };
        }
      }
    };

    // Monitor for new EventEmitter instances
    const originalSetTimeout = window.setTimeout;
    window.setTimeout = function(...args) {
      const result = originalSetTimeout.apply(this, args);
      // Patch any EventEmitter-like objects in arguments
      args.forEach(arg => {
        if (typeof arg === 'function') {
          try {
            const boundThis = arg.bind ? arg.bind({}) : undefined;
            if (boundThis && boundThis._events !== undefined) {
              patchEventEmitter(boundThis);
            }
          } catch (e) {
            // Ignore binding errors
          }
        }
      });
      return result;
    };
  }
})();
`;

            if (fixedContents !== contents) {
              // Prepend runtime polyfill
              fixedContents = runtimePolyfill + fixedContents;
              await fs.writeFile(outputPath, fixedContents);
              console.log(
                `[eventemitter-polyfill] Successfully fixed all EventEmitter methods and added runtime polyfill in ${outputPath}`
              );
            } else {
              // Still add runtime polyfill even if no build-time fixes needed
              fixedContents = runtimePolyfill + contents;
              await fs.writeFile(outputPath, fixedContents);
              console.log(
                `[eventemitter-polyfill] No build-time fixes needed, but added runtime polyfill to ${outputPath}`
              );
            }
          }
        } catch (error) {
          console.warn('[eventemitter-polyfill] Could not process output file:', error.message);
        }
      }
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
    // Redirect jsforce-node to browser-compatible jsforce
    '@jsforce/jsforce-node': 'jsforce',
    // Force use of our custom process polyfill instead of esbuild's built-in
    process: processPolyfillPath,
    // Node.js built-in module polyfills
    'node:path': 'path-browserify',
    'node:os': 'os-browserify',
    'node:buffer': 'buffer',
    'node:stream': 'stream-browserify',
    'node:util': 'util',
    'node:events': 'events',
    events: 'events',
    'node:url': 'url',
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
  plugins: [pipeTransformPlugin(), eventEmitterPolyfillPlugin(), nodeModulesPolyfillPlugin()]
};
