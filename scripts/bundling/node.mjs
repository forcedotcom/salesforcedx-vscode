const nodeBuiltins = [
  'node:os',
  'node:path',
  'node:fs',
  'node:util',
  'node:crypto',
  'node:events',
  'node:stream',
  'node:url',
  'node:http',
  'node:https',
  'node:net',
  'node:tls',
  'node:dns',
  'node:child_process',
  'node:fs/promises',
  'node:path/posix',
  'node:querystring',
  'node:assert/strict',
  'node:perf_hooks',
  'os',
  'path',
  'fs',
  'util',
  'crypto',
  'events',
  'stream',
  'url',
  'http',
  'https',
  'net',
  'tls',
  'dns',
  'child_process',
  'querystring',
  'assert',
  'constants',
  'module',
  'timers',
  'domain',
  'worker_threads',
  'tty',
  'zlib',
  'console',
  'http2'
];

export const commonConfigNode = {
  bundle: true,
  format: 'cjs',
  platform: 'node',
  external: ['vscode', ...nodeBuiltins],
  // TODO: we need a way to turn this off for debugging and local dev
  minify: true,
  sourcemap: true,
  keepNames: true,
  logOverride: {
    'unsupported-dynamic-import': 'error'
  },
  define: {
    // this prevents the logger from writing to any files, obviating the need for pino-bundling stuff
    'process.env.SF_DISABLE_LOG_FILE': "'true'"
  }
};
