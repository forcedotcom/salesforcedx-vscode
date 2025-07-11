export const commonConfigBrowser = {
  bundle: true,
  format: 'esm',
  platform: 'browser',
  external: ['vscode'],
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
