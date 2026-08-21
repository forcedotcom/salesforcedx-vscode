import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');
const { shouldUpdateVersion } = require('../../../scripts/release-package-selection.js');

test('the UI workspace cannot be published or release-versioned', () => {
  assert.equal(packageJson.private, true);
  assert.equal('publishConfig' in packageJson, false);
  assert.equal('versionedIndependently' in packageJson, false);
  assert.equal(shouldUpdateVersion(packageJson), false);
  assert.equal(shouldUpdateVersion({ private: true, publishConfig: { access: 'public' } }), false);
  assert.equal(shouldUpdateVersion({ publishConfig: { access: 'public' } }), true);
  assert.equal(shouldUpdateVersion({ scripts: { 'vscode:publish': 'publish' } }), true);
  assert.equal(shouldUpdateVersion({ publishConfig: { access: 'public' }, versionedIndependently: true }), false);
});

test('source stays browser-safe and presentation stays Effect-runtime-free', async () => {
  const sourceRoot = new URL('../src/', import.meta.url);
  const sourceFiles = (await readdir(sourceRoot, { recursive: true })).filter(file => file.endsWith('.ts'));
  const sources = await Promise.all(sourceFiles.map(file => readFile(new URL(file, sourceRoot), 'utf8')));
  const allSource = sources.join('\n');
  const presentationSource = await readFile(
    new URL('../src/components/soqlBuilderElement.ts', import.meta.url),
    'utf8'
  );

  assert.doesNotMatch(allSource, /from\s+['"](?:vscode|jsforce|salesforcedx-vscode-services)(?:\/[^'"]*)?['"]/u);
  assert.doesNotMatch(presentationSource, /ManagedRuntime|Effect\.(?:runFork|runPromise|runSync)/u);
});

test('the browser bundle is self-contained and contains no spike or VS Code host imports', async () => {
  const bundle = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');

  assert.doesNotMatch(bundle, /litSpike|lit-spike|acquireVsCodeApi/u);
  assert.doesNotMatch(bundle, /(?:from\s*|import\s*)[(']\s*(?:node:|vscode|salesforcedx-vscode-services|jsforce)/u);
});
