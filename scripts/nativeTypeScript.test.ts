/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { spawnSync } from 'node:child_process';

const runTsx = (args: string[]) =>
  spawnSync(process.execPath, ['--import', 'tsx', ...args], { encoding: 'utf8', timeout: 60_000 });

describe('TypeScript script entry points', () => {
  it.each([
    'scripts/xsd/scrape-all-metadata-pages.ts',
    'scripts/xsd/scrape-single-page.ts',
    'scripts/codeBuilderLocalE2E.ts'
  ])(
    '%s prints help without running external operations',
    script => {
      const result = runTsx([script, '--help']);
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/[Uu]sage/);
    },
    60_000
  );

  it('prints the native App Insights command when no query is supplied', () => {
    const result = runTsx(['scripts/queryAppInsights.ts']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Usage: tsx queryAppInsights.ts <kql-query>');
  });

  it('imports guarded entry points without running their CLIs and converts and validates an XSD fixture', () => {
    const result = runTsx([
      '--input-type=module',
      '--eval',
      `
        import assert from 'node:assert/strict';
        import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
        import { tmpdir } from 'node:os';
        import { join } from 'node:path';
        import { createXsdFromJson } from './scripts/xsd/jsonToXsdConverter.ts';
        import {
          validateWellFormedXml, validateSchemaReferences, validateNoDuplicateTypes, validateEncoding
        } from './scripts/xsd/validateXsd.ts';
        import { queryAppInsights } from './scripts/queryAppInsights.ts';

        assert.equal(typeof queryAppInsights, 'function');
        const directory = mkdtempSync(join(tmpdir(), 'native-xsd-'));
        try {
          const jsonFile = join(directory, 'metadata.json');
          const xsdFile = join(directory, 'metadata.xsd');
          writeFileSync(jsonFile, JSON.stringify({ Example: {
            parent: 'Metadata', short_description: 'Example & description', url: 'https://example.com',
            fields: [{ 'Field Name': 'enabled', 'Field Type': 'boolean', Description: 'Enabled' }]
          } }));
          assert.equal(createXsdFromJson(jsonFile, xsdFile), 1);
          assert.deepEqual(await validateWellFormedXml(xsdFile), []);
          assert.deepEqual(validateSchemaReferences(xsdFile), []);
          assert.deepEqual(validateNoDuplicateTypes(xsdFile), []);
          assert.deepEqual(validateEncoding(xsdFile), []);
        } finally {
          rmSync(directory, { recursive: true, force: true });
        }
      `
    ]);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });
});
