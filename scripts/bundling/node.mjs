export const nodeConfig = {
  external: ['vscode'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  keepNames: true,
  minify: true,
  supported: {
    'dynamic-import': false
  },
  logOverride: {
    'unsupported-dynamic-import': 'error'
  },
  define: {
    // this prevents the logger from writing to any files, obviating the need for pino-bundling stuff
    'process.env.SF_DISABLE_LOG_FILE': "'true'"
  }
};
