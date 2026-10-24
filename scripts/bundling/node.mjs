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
  target: 'node24.18.0',
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

export const nodeEsmConfig = {
  ...nodeConfig,
  format: 'esm',
  outExtension: { '.js': '.mjs' },
  supported: { ...nodeConfig.supported, 'dynamic-import': true },
  // Bridge CJS dependencies inside the ESM entry. VS Code's module is supplied by the ESM host;
  // Node built-ins and any explicitly external Node packages use createRequire.
  banner: {
    js: `import { createRequire as __createRequire } from 'node:module';
import { dirname as __dirnameFromPath } from 'node:path';
import { fileURLToPath as __fileURLToPath } from 'node:url';
import * as __vscode from 'vscode';
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __dirnameFromPath(__filename);
const __nodeRequire = __createRequire(import.meta.url);
const require = new Proxy(__nodeRequire, {
  apply(target, thisArg, args) {
    return args[0] === 'vscode' ? __vscode : Reflect.apply(target, thisArg, args);
  }
});`
  }
};
