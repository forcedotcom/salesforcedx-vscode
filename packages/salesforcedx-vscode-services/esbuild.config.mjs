/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { build } from 'esbuild';
import { nodeConfig } from '../../scripts/bundling/node.mjs';
import { commonConfigBrowser } from '../../scripts/bundling/web.mjs';
import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageDir = __dirname;
const repoRoot = join(packageDir, '../..');

const CODE_BUILDER_WEB_SECTION = 'salesforcedx-vscode-code-builder-web';
const INSTANCE_URL_KEY = 'instanceUrl';
const ACCESS_TOKEN_KEY = 'accessToken';
const API_VERSION_KEY = 'apiVersion';

const buildWebConfig = async () => {
  const configMap = {};
  
  // Get org display output if ESBUILD_WEB_ORG_ALIAS is set
  if (process.env.ESBUILD_WEB_ORG_ALIAS) {
    try {
      const output = execSync(`sf org display -o ${process.env.ESBUILD_WEB_ORG_ALIAS} --json`, {
        encoding: 'utf-8',
        stdio: ['inherit', 'pipe', 'pipe']
      });
      const orgDisplayResponse = JSON.parse(output);
      const orgData = orgDisplayResponse.result || orgDisplayResponse;
      const apiVersion = orgData.version || orgData.apiVersion;
      if (orgData.instanceUrl && orgData.accessToken && apiVersion && Object.keys(orgData).length > 0) {
        configMap[`${CODE_BUILDER_WEB_SECTION}.${INSTANCE_URL_KEY}`] = orgData.instanceUrl;
        configMap[`${CODE_BUILDER_WEB_SECTION}.${ACCESS_TOKEN_KEY}`] = orgData.accessToken;
        configMap[`${CODE_BUILDER_WEB_SECTION}.${API_VERSION_KEY}`] = apiVersion;
      }
    } catch (error) {
      // Skip org settings if command fails
    }
  }
  
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
  
  return Object.keys(configMap).length > 0 ? JSON.stringify(configMap) : undefined;
};

// Desktop build (Node.js environment)
const nodeBuild = await build({
  ...nodeConfig,
  entryPoints: ['./out/src/index.js'],
  outdir: './dist',
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
  metafile: true
});

await writeFile('dist/node-metafile.json', JSON.stringify(nodeBuild.metafile, null, 2));
await writeFile('dist/browser-metafile.json', JSON.stringify(browserBuild.metafile, null, 2));
