export const commonConfigNode = {
  bundle: true,
  format: 'cjs',
  platform: 'node',
  external: ['vscode'],
  // TODO: we need a way to turn this off for debugging and local dev
  minify: true,
  keepNames: true,
  logOverride: {
    'unsupported-dynamic-import': 'error'
  }
};
