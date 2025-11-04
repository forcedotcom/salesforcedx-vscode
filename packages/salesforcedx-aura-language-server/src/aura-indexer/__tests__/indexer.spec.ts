/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Mock JSON imports from baseContext.ts - these are runtime require() calls in compiled code
const mockJsonFromCommon = (relativePath: string) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pathModule = require('node:path');
  let current = __dirname;
  while (!fs.existsSync(pathModule.join(current, 'package.json'))) {
    const parent = pathModule.resolve(current, '..');
    if (parent === current) break;
    current = parent;
  }
  const packagesDir = pathModule.resolve(current, '..');
  const filePath = pathModule.join(packagesDir, 'salesforcedx-lightning-lsp-common', 'src', relativePath);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return { default: content, ...content };
};

// Mock JSON imports from indexer.ts
const mockJsonFromAuraServer = (relativePath: string) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pathModule = require('node:path');
  let current = __dirname;
  while (!fs.existsSync(pathModule.join(current, 'package.json'))) {
    const parent = pathModule.resolve(current, '..');
    if (parent === current) break;
    current = parent;
  }
  const filePath = pathModule.join(current, 'src', relativePath);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return { default: content, ...content };
};

// Mock relative imports from baseContext.js - these need to match the exact paths Jest resolves when baseContext.js
// executes require("./resources/..."). Since baseContext.js is in out/src/, the relative path
// resolves to out/src/resources/... which we mock using paths relative to the test file.
jest.mock(
  '../../../../salesforcedx-lightning-lsp-common/out/src/resources/core/jsconfig-core.json',
  () => mockJsonFromCommon('resources/core/jsconfig-core.json'),
  {
    virtual: true
  }
);
jest.mock(
  '../../../../salesforcedx-lightning-lsp-common/out/src/resources/core/settings-core.json',
  () => mockJsonFromCommon('resources/core/settings-core.json'),
  {
    virtual: true
  }
);
jest.mock(
  '../../../../salesforcedx-lightning-lsp-common/out/src/resources/sfdx/jsconfig-sfdx.json',
  () => mockJsonFromCommon('resources/sfdx/jsconfig-sfdx.json'),
  {
    virtual: true
  }
);

// Mock JSON imports for aura indexer - from indexer.ts which is in src/aura-indexer/
// So the relative path from indexer.ts is ../resources/, but from test file (src/aura-indexer/__tests__/) it's ../../resources/
jest.mock('../../resources/aura-standard.json', () => mockJsonFromAuraServer('resources/aura-standard.json'));
jest.mock('../../resources/transformed-aura-system.json', () =>
  mockJsonFromAuraServer('resources/transformed-aura-system.json')
);

import { FileSystemDataProvider } from '@salesforce/salesforcedx-lightning-lsp-common';
import { SFDX_WORKSPACE_ROOT, sfdxFileSystemProvider } from '@salesforce/salesforcedx-lightning-lsp-common/testUtils';
import * as path from 'node:path';
import URI from 'vscode-uri';
import { AuraWorkspaceContext } from '../../context/auraContext';
import AuraIndexer from '../indexer';

// Normalize paths for cross-platform test consistency
const normalize = (start: string, p: string): string => {
  // Convert backslashes to forward slashes and normalize to POSIX format
  const normalizedStart = path.posix.normalize(start.replace(/\\/g, '/'));
  const normalizedP = path.posix.normalize(p.replace(/\\/g, '/'));

  // Handle Windows case-insensitive paths by comparing lowercase
  if (normalizedP.toLowerCase().startsWith(normalizedStart.toLowerCase())) {
    return path.posix.relative(normalizedStart, normalizedP);
  }
  return normalizedP;
};

const uriToFile = (uri: string): string => URI.parse(uri).fsPath;

describe('indexer parsing content', () => {
  it('aura indexer', async () => {
    const context = new AuraWorkspaceContext(SFDX_WORKSPACE_ROOT, new FileSystemDataProvider());
    await context.initialize();
    await context.configureProject();

    const auraIndexer = new AuraIndexer(context);
    await auraIndexer.configureAndIndex();
    context.addIndexingProvider({ name: 'aura', indexer: auraIndexer });

    let markup = await context.findAllAuraMarkup();
    markup = markup.map(p => normalize(SFDX_WORKSPACE_ROOT, p)).sort();
    expect(markup).toMatchSnapshot();
    const tags = auraIndexer.getAuraTags();
    tags.forEach(taginfo => {
      if (taginfo.file) {
        taginfo.file = normalize(SFDX_WORKSPACE_ROOT, taginfo.file);
      }
      if (taginfo.location?.uri) {
        taginfo.location.uri = normalize(SFDX_WORKSPACE_ROOT, uriToFile(taginfo.location.uri));
      }
      if (taginfo.attributes) {
        taginfo.attributes = taginfo.attributes.sort((a, b) => a.name.localeCompare(b.name));
        for (const attribute of taginfo.attributes) {
          if (attribute.location?.uri) {
            attribute.location.uri = normalize(SFDX_WORKSPACE_ROOT, uriToFile(attribute.location.uri));
          }
        }
      }
    });
    const sortedTags = new Map([...tags.entries()].sort());
    expect(sortedTags).toMatchSnapshot();

    const namespaces = auraIndexer.getAuraNamespaces().sort();
    expect(namespaces).toMatchSnapshot();
  });

  it('should index a valid aura component', async () => {
    const context = new AuraWorkspaceContext(SFDX_WORKSPACE_ROOT, sfdxFileSystemProvider);
    await context.initialize();
    await context.configureProject();
    const auraIndexer = new AuraIndexer(context);
    await auraIndexer.configureAndIndex();
    context.addIndexingProvider({ name: 'aura', indexer: auraIndexer });

    const auraFilename = path.join(SFDX_WORKSPACE_ROOT, 'force-app/main/default/aura/wireLdsCmp/wireLdsCmp.cmp');
    const tagInfo = auraIndexer.indexFile(auraFilename, true);
    expect(tagInfo).toBeObject();
    expect(tagInfo?.name).toEqual('c:wireLdsCmp');
    expect(tagInfo?.file).toEndWith('wireLdsCmp.cmp');
    expect(tagInfo?.type).toEqual('CUSTOM');
    expect(tagInfo?.lwc).toEqual(false);
    expect(tagInfo?.location).toBeObject();
    expect(tagInfo?.location?.uri).toEndWith('wireLdsCmp.cmp');
    expect(tagInfo?.location?.range).toBeObject();
    expect(tagInfo?.namespace).toEqual('c');
  });

  xit('should handle indexing an invalid aura component', async () => {
    const context = new AuraWorkspaceContext(SFDX_WORKSPACE_ROOT, new FileSystemDataProvider());
    await context.initialize();
    await context.configureProject();
    const auraIndexer = new AuraIndexer(context);
    await auraIndexer.configureAndIndex();
    context.addIndexingProvider({ name: 'aura', indexer: auraIndexer });

    const dummyFilePath = '/invalid.cmp';

    const tagInfo = await auraIndexer.indexFile(dummyFilePath, true);
    expect(tagInfo).toBeUndefined();
  });
});
