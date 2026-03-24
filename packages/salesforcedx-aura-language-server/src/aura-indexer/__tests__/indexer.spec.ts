/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LspFileSystemAccessor, NormalizedPath, normalizePath } from '@salesforce/salesforcedx-lightning-lsp-common';
import {
  createMockWorkspaceFindFilesConnection,
  getSfdxWorkspaceRelativePaths,
  SFDX_WORKSPACE_ROOT,
  sfdxFileSystemAccessor
} from '@salesforce/salesforcedx-lightning-lsp-common/testUtils';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Connection } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { AuraWorkspaceContext } from '../../context/auraContext';
import AuraIndexer from '../indexer';

const normRoot = normalizePath(SFDX_WORKSPACE_ROOT);
const isUnderWorkspace = (p: string): boolean => {
  const key = normalizePath(p);
  return key === normRoot || key.startsWith(`${normRoot}/`);
};

// Normalize paths for cross-platform test consistency
// Converts absolute paths to relative paths from the workspace root
const normalize = (start: string, p: string): string => {
  const normalizedStart = normalizePath(start);
  const normalizedP = normalizePath(p);

  if (normalizedP.toLowerCase().startsWith(normalizedStart.toLowerCase())) {
    return path.posix.relative(normalizedStart, normalizedP);
  }
  return normalizedP;
};

const uriToFile = (uri: string): string => URI.parse(uri).fsPath;

describe('indexer parsing content', () => {
  beforeAll(() => {
    sfdxFileSystemAccessor.setWorkspaceFolderUris([URI.file(SFDX_WORKSPACE_ROOT).toString()]);
    sfdxFileSystemAccessor.setConnection(
      createMockWorkspaceFindFilesConnection(SFDX_WORKSPACE_ROOT, {
        relativePaths: getSfdxWorkspaceRelativePaths()
      }) as Connection
    );

    jest.spyOn(sfdxFileSystemAccessor, 'getFileStat').mockImplementation((uri: string) => {
      const key = normalizePath(uri);
      if (!isUnderWorkspace(key)) return Promise.resolve(undefined);
      try {
        const stat = fs.statSync(uri);
        return Promise.resolve({
          type: stat.isDirectory() ? ('directory' as const) : ('file' as const),
          exists: true,
          ctime: stat.ctimeMs,
          mtime: stat.mtimeMs,
          size: stat.size
        });
      } catch {
        return Promise.resolve(undefined);
      }
    });
    jest.spyOn(sfdxFileSystemAccessor, 'getFileContent').mockImplementation((uri: string) => {
      const key = normalizePath(uri);
      if (!isUnderWorkspace(key)) return Promise.resolve(undefined);
      try {
        return Promise.resolve(fs.readFileSync(uri, 'utf8'));
      } catch {
        return Promise.resolve(undefined);
      }
    });
    jest.spyOn(sfdxFileSystemAccessor, 'getDirectoryListing').mockImplementation((uri: NormalizedPath) => {
      const key = normalizePath(uri);
      if (!isUnderWorkspace(key)) return Promise.resolve([]);
      try {
        const entries = fs.readdirSync(uri, { withFileTypes: true });
        const result = entries.map(e => ({
          name: e.name,
          type: (e.isDirectory() ? 'directory' : 'file') as 'directory' | 'file',
          uri: `file://${path.join(uri, e.name)}`
        }));
        return Promise.resolve(result);
      } catch {
        return Promise.resolve([]);
      }
    });
    jest.spyOn(sfdxFileSystemAccessor, 'updateFileContent').mockResolvedValue(undefined);
  });

  it('aura indexer', async () => {
    const context = new AuraWorkspaceContext(SFDX_WORKSPACE_ROOT, sfdxFileSystemAccessor);
    context.initialize('SFDX');
    await context.configureProject();

    const auraIndexer = new AuraIndexer(context);
    await auraIndexer.configureAndIndex();
    context.addIndexingProvider({ name: 'aura', indexer: auraIndexer });

    const markup = (await context.findAllAuraMarkup()).map(p => normalize(SFDX_WORKSPACE_ROOT, p)).toSorted();
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
        taginfo.attributes = taginfo.attributes.toSorted((a, b) => a.name.localeCompare(b.name));
        for (const attribute of taginfo.attributes) {
          if (attribute.location?.uri) {
            attribute.location.uri = normalize(SFDX_WORKSPACE_ROOT, uriToFile(attribute.location.uri));
          }
        }
      }
    });
    const sortedTags = new Map([...tags.entries()].toSorted());
    expect(sortedTags).toMatchSnapshot();

    const namespaces = auraIndexer.getAuraNamespaces().toSorted();
    expect(namespaces).toMatchSnapshot();
  });

  it('should index a valid aura component', async () => {
    const context = new AuraWorkspaceContext(SFDX_WORKSPACE_ROOT, sfdxFileSystemAccessor);
    context.initialize('SFDX');
    await context.configureProject();
    const auraIndexer = new AuraIndexer(context);
    await auraIndexer.configureAndIndex();
    context.addIndexingProvider({ name: 'aura', indexer: auraIndexer });

    const auraFilename = path.join(SFDX_WORKSPACE_ROOT, 'force-app/main/default/aura/wireLdsCmp/wireLdsCmp.cmp');
    const tagInfo = await auraIndexer.indexFile(auraFilename, true);
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
    const context = new AuraWorkspaceContext(SFDX_WORKSPACE_ROOT, new LspFileSystemAccessor());
    context.initialize('SFDX');
    await context.configureProject();
    const auraIndexer = new AuraIndexer(context);
    await auraIndexer.configureAndIndex();
    context.addIndexingProvider({ name: 'aura', indexer: auraIndexer });

    const dummyFilePath = '/invalid.cmp';

    const tagInfo = await auraIndexer.indexFile(dummyFilePath, true);
    expect(tagInfo).toBeUndefined();
  });
});
