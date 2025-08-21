/**
 * NOTE: This file does NOT really generate a bundle version of apex-node
 * apex-node is bundled directly in salesforcedx-vscode
 * The file is only used to detect any potential risks to esbuild.
 **/
import { build } from 'esbuild';


await build({
  bundle: true,
  format: 'cjs',
  platform: 'node',
  external: [
    'jsonpath'
  ], // The whitelist of dependencies that are not bundle-able
  keepNames: true,
  plugins: [
  ],
  supported: {
    'dynamic-import': false
  },
  logOverride: {
    'unsupported-dynamic-import': 'error',
  },      entryPoints: ['./lib/src/index.js'],
    outdir: 'dist'
});
