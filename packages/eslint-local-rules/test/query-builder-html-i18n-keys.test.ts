/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ESLint } from 'eslint';
import * as fs from 'node:fs';
import * as path from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- CJS plugin exports
const htmlEslintPlugin = require('@html-eslint/eslint-plugin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const localPlugin: ESLint.Plugin = require('../out/index.js');

const htmlRecommended = htmlEslintPlugin.configs['flat/recommended'] as {
  plugins: Record<string, ESLint.Plugin>;
  languageOptions?: { parser?: unknown };
  rules?: Record<string, unknown>;
};

const ruleId = 'local/query-builder-html-i18n-keys';

const fixturesDir = path.join(__dirname, 'fixtures', 'query-builder-html-i18n');
const validHtmlRel =
  'packages/eslint-local-rules/test/fixtures/query-builder-html-i18n/src/soql-builder-ui/modules/querybuilder/app/sample.html';

function findMonorepoRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 12; i += 1) {
    if (fs.existsSync(path.join(dir, 'eslint.config.mjs'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error('Could not locate monorepo root (eslint.config.mjs)');
}

const repoRoot = findMonorepoRoot();

function createEslintForFixture(): ESLint {
  return new ESLint({
    cwd: repoRoot,
    overrideConfigFile: true,
    overrideConfig: [
      {
        ...htmlRecommended,
        files: [
          '**/eslint-local-rules/test/fixtures/query-builder-html-i18n/**/*.html',
          'packages/eslint-local-rules/test/fixtures/query-builder-html-i18n/**/*.html'
        ],
        plugins: {
          ...htmlRecommended.plugins,
          local: localPlugin
        },
        rules: {
          [ruleId]: 'error'
        }
      }
    ]
  });
}

describe('query-builder-html-i18n-keys', () => {
  it('passes when i18n keys exist in catalog', async () => {
    const eslint = createEslintForFixture();
    const results = await eslint.lintFiles([path.join(repoRoot, validHtmlRel)]);
    expect(results[0].errorCount).toBe(0);
  });

  it('reports unknown i18n keys', async () => {
    const eslint = createEslintForFixture();
    const badPath = path.join(fixturesDir, 'invalid-template.html');
    fs.writeFileSync(
      badPath,
      '<template><p>{i18n.not_in_catalog_xyz}</p></template>',
      'utf8'
    );
    try {
      const results = await eslint.lintFiles([badPath]);
      expect(
        results[0].messages.some(
          m => m.ruleId === ruleId && /not_in_catalog_xyz/.test(m.message)
        )
      ).toBe(true);
    } finally {
      fs.unlinkSync(badPath);
    }
  });
});
