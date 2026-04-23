/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { build } from 'esbuild';
import copy from 'esbuild-plugin-copy';
import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { nodeConfig } from '../../scripts/bundling/node.mjs';
import { commonConfigBrowser } from '../../scripts/bundling/web.mjs';

import { writeFile, readFile, readdir, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import pkg from './package.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageDir = __dirname;

// Resolve @salesforce/templates so copy works with npm workspaces (deps hoisted to repo root).
// Relative to cwd (package dir), node_modules/@salesforce/templates often doesn't exist.
const templatesPkgPath = dirname(createRequire(import.meta.url).resolve('@salesforce/templates/package.json'));
const templatesLibPath = join(templatesPkgPath, 'lib/templates');
// Use forward slashes in glob so copy works on Windows CI (globby is cross-platform when pattern uses /).
const templatesBase = templatesLibPath.replace(/\\/g, '/');

const copyTemplates = copy({
  resolveFrom: 'cwd',
  globbyOptions: { dot: true },
  assets: [
    { from: [`${templatesBase}/apexclass/**/*`], to: ['./dist/templates/apexclass'] },
    { from: [`${templatesBase}/apextrigger/**/*`], to: ['./dist/templates/apextrigger'] },
    { from: [`${templatesBase}/lightningcomponent/lwc/**/*`], to: ['./dist/templates/lightningcomponent/lwc'] },
    { from: [`${templatesBase}/staticresource/**/*`], to: ['./dist/templates/staticresource'] },
    { from: [`${templatesBase}/visualforcepage/**/*`], to: ['./dist/templates/visualforcepage'] },
    { from: [`${templatesBase}/visualforcecomponent/**/*`], to: ['./dist/templates/visualforcecomponent'] }
  ]
});

// Generate manifest listing all template file paths (relative to templates root).
// Web bundle reads this instead of vscode.workspace.fs.readDirectory (not supported on HTTPS extension URIs).
// Walk the copy destination (not source) so manifest only lists files that were actually bundled.
// Ensure dist/templates exists (esbuild-plugin-copy does not create it when the source glob matches no files).
const generateTemplatesManifest = async () => {
  const distTemplates = join(packageDir, 'dist/templates');

  await mkdir(distTemplates, { recursive: true });

  const prefix = distTemplates.replace(/\\/g, '/') + '/';
  const paths = (await readdir(distTemplates, { recursive: true, withFileTypes: true }))
    .filter(e => e.isFile() && e.name !== 'manifest.json')
    .map(e => `${(e.parentPath ?? e.path).replace(/\\/g, '/')}/${e.name}`.replace(prefix, ''));

  await writeFile(join(distTemplates, 'manifest.json'), JSON.stringify(paths));
  console.log(`[esbuild] Generated templates manifest: ${paths.length} files`);
};

const execAsync = promisify(exec);
const repoRoot = join(packageDir, '../..');

// Derive section and keys from package.json contributes.configuration.properties

const buildWebConfig = async () => {
  if (process.env.ESBUILD_WEB_ORG_ALIAS) {
    const configMap = {};

    try {
      const { stdout } = await execAsync(`sf org display -o ${process.env.ESBUILD_WEB_ORG_ALIAS} --json`, {
        env: { ...process.env, NO_COLOR: '1' }
      });
      const orgDisplayResponse = JSON.parse(stdout);
      const orgData = orgDisplayResponse.result;
      const ORG_DISPLAY_KEYS = ['instanceUrl', 'accessToken', 'apiVersion'];

      if (ORG_DISPLAY_KEYS.every(k => orgData[k])) {
        ORG_DISPLAY_KEYS.forEach(key => {
          const fullKey = Object.keys(pkg.contributes?.configuration?.properties ?? {})
            .filter(k => ORG_DISPLAY_KEYS.includes(k.split('.')[1]))
            .find(k => k.endsWith(`.${key}`));
          if (fullKey) configMap[fullKey] = orgData[key];
        });
        console.log('[esbuild] Added org credentials to configMap');
      }
    } catch (error) {
      console.error(`[esbuild] Failed to get web config from org ${process.env.ESBUILD_WEB_ORG_ALIAS}:`, error.message);
      throw error;
    }

    // Enable file traces — span files in ~/.sf/vscode-spans/
    configMap['salesforcedx-vscode-salesforcedx.enableFileTraces'] = true;

    // Read extra settings if ESBUILD_WEB_LOCAL is set
    if (process.env.ESBUILD_WEB_LOCAL) {
      const extraSettingsPath = join(repoRoot, '.esbuild-web-extra-settings.json');
      if (existsSync(extraSettingsPath)) {
        try {
          const extraSettingsContent = await readFile(extraSettingsPath, 'utf-8');
          const extraSettings = JSON.parse(extraSettingsContent);
          Object.assign(configMap, extraSettings);
        } catch (error) {
          console.warn(`Failed to read extra settings: ${error.message}`);
        }
      }
    }
    return JSON.stringify(configMap);
  }
};

// Desktop build (Node.js environment)
const nodeBuild = await build({
  ...nodeConfig,
  entryPoints: ['./out/src/index.js'],
  outdir: './dist',
  plugins: [...(nodeConfig.plugins ?? []), copyTemplates],
  metafile: true
});

// Browser build (browser environment)
const webConfigJson = await buildWebConfig();
const browserDefine = {
  ...commonConfigBrowser.define,
  'process.env.ESBUILD_WEB_CONFIG': webConfigJson ? `'${webConfigJson.replace(/'/g, "\\'")}'` : "'undefined'"
};
const browserBuild = await build({
  ...commonConfigBrowser,
  define: browserDefine,
  entryPoints: ['./out/src/index.js'],
  outfile: './dist/web/index.js',
  plugins: [...(commonConfigBrowser.plugins ?? []), copyTemplates],
  metafile: true
});

await writeFile('dist/node-metafile.json', JSON.stringify(nodeBuild.metafile, null, 2));
await writeFile('dist/browser-metafile.json', JSON.stringify(browserBuild.metafile, null, 2));
await generateTemplatesManifest();
