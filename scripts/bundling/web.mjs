import { polyfillNode } from 'esbuild-plugin-polyfill-node';

export const commonConfigBrowser = {
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
  define: {
    // this prevents the logger from writing to any files, obviating the need for pino-bundling stuff
    'process.env.SF_DISABLE_LOG_FILE': "'true'",
    // Ensure global is available for Node.js modules
    global: 'globalThis'
  },
  alias: {
    // proper-lockfile and SDR use graceful-fs
    'graceful-fs': 'memfs',
    jsonwebtoken: 'jsonwebtoken-esm',
    '@jsforce/jsforce-node': 'jsforce/browser',
    '@jsforce/jsforce-node/lib': 'jsforce/browser',
    'node:path/posix': 'path-browserify',
    'node:path': 'path-browserify'
  },
  plugins: [
    polyfillNode({
      globals: {
        global: true,
        buffer: true,
        process: true
      },
      polyfills: {
        _stream_duplex: true,
        _stream_passthrough: true,
        _stream_readable: true,
        _stream_transform: true,
        _stream_writable: true,
        'assert/strict': true,
        assert: true,
        buffer: true,
        child_process: 'empty',
        crypto: true,
        dns: 'empty',
        events: true,
        http: true,
        https: true,
        net: 'empty',
        os: true,
        path: true,
        perf_hooks: true,
        process: true,
        querystring: true,
        stream: true,
        timers: true,
        tls: 'empty',
        url: true,
        util: true,
        fs: true
      }
    })
  ]
};
