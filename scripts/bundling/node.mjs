// Disable minify when DEBUG_BUNDLE=1 (e.g. preLaunchTask "Compile and Bundle") so the debugger shows real variable names
const minify = process.env.DEBUG_BUNDLE !== '1';

export const nodeConfig = {
  external: ['vscode'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  // Resolve effect's ESM build so unused submodules (e.g. fast-check via Schema) tree-shake out.
  // Global on purpose: alters resolution for EVERY dep, not just effect. Validated across all node
  // consumers by a full vscode:bundle + desktop e2e. Do not re-scope to per-package opt-in or delete.
  conditions: ['import', 'module', 'default'],
  target: 'es2023',
  keepNames: true,
  minify,
  sourcemap: true,
  supported: {
    'dynamic-import': false
  },
  logOverride: {
    'unsupported-dynamic-import': 'error',
    'require-resolve-not-external': 'error'
  },
  define: {
    // this prevents the logger from writing to any files, obviating the need for pino-bundling stuff
    'process.env.SF_DISABLE_LOG_FILE': "'true'",
    'process.env.ESBUILD_PLATFORM': "'node'"
  }
};
