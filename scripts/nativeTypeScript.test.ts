/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { spawnSync } from 'node:child_process';

const runNode = (args: string[]) => spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 30_000 });

describe('native TypeScript scripts', () => {
  it.each([
    'scripts/xsd/scrapeAllMetadataPages.mts',
    'scripts/xsd/scrapeSinglePage.mts',
    'scripts/codeBuilderLocalE2E.mts',
    'scripts/installVSIXFromBranch.mts',
    'scripts/reportInstalls.mts',
    'scripts/xsd/fixXsdErrors.mts',
    'scripts/xsd/jsonToXsdConverter.mts',
    'scripts/xsd/validateXsd.mts'
  ])('%s starts and prints help without running external operations', script => {
    const result = runNode(['--permission', '--allow-fs-read=*', script, '--help']);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/[Uu]sage/);
  });

  it('prints the native App Insights command when no query is supplied', () => {
    const result = runNode(['scripts/queryAppInsights.mts']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Usage: node scripts/queryAppInsights.mts <kql-query>');
  });

  it('imports guarded entry points without running their CLIs and converts and validates an XSD fixture', () => {
    const result = runNode([
      '--input-type=module',
      '--eval',
      `
        import assert from 'node:assert/strict';
        import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
        import { tmpdir } from 'node:os';
        import { join } from 'node:path';
        import { createXsdFromJson } from './scripts/xsd/jsonToXsdConverter.mts';
        import {
          validateWellFormedXml, validateSchemaReferences, validateNoDuplicateTypes, validateEncoding
        } from './scripts/xsd/validateXsd.mts';
        import { queryAppInsights } from './scripts/queryAppInsights.mts';

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
