/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// Mock JSON imports using fs.readFileSync since Jest cannot directly import JSON files
jest.mock('../resources/transformed-lwc-standard.json', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  const pathModule = require('node:path') as typeof import('node:path');
  // Find package root (lwc-language-server)
  let current = __dirname;
  while (!fs.existsSync(pathModule.join(current, 'package.json'))) {
    const parent = pathModule.resolve(current, '..');
    if (parent === current) break;
    current = parent;
  }
  const filePath = pathModule.join(current, 'src', 'resources', 'transformed-lwc-standard.json');
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  // JSON imports in TypeScript are treated as default exports
  return { default: content, ...content };
});

import { normalizePath, WORKSPACE_FIND_FILES_REQUEST } from '@salesforce/salesforcedx-lightning-lsp-common';
import {
  createMockWorkspaceFindFilesConnection,
  getSfdxWorkspaceRelativePaths,
  SFDX_WORKSPACE_ROOT,
  SFDX_WORKSPACE_STRUCTURE,
  sfdxFileSystemAccessor
} from '@salesforce/salesforcedx-lightning-lsp-common/testUtils';
import * as path from 'node:path';
import { URI } from 'vscode-uri';
import ComponentIndexer from '../componentIndexer';
import { DataProviderAttributes, LWCDataProvider } from '../lwcDataProvider';
import { TagAttrs, createTag, getTagName } from '../tag';

// Discovery via workspace/findFiles (no server-side cache)
sfdxFileSystemAccessor.setWorkspaceFolderUris([URI.file(SFDX_WORKSPACE_ROOT).toString()]);
sfdxFileSystemAccessor.setFindFilesFromConnection(
  createMockWorkspaceFindFilesConnection(SFDX_WORKSPACE_ROOT, {
    relativePaths: getSfdxWorkspaceRelativePaths()
  }) as Parameters<typeof sfdxFileSystemAccessor.setFindFilesFromConnection>[0],
  WORKSPACE_FIND_FILES_REQUEST
);

// LspFileSystemAccessor has no LSP read/stat in tests, so init() would exit early (fileExists(sfdx-project.json))
// and createTagFromFile would get no content. Mock stat/content from SFDX_WORKSPACE_STRUCTURE so discovery works.
const contentByPath: Record<string, string> = {};
for (const [rel, content] of Object.entries(SFDX_WORKSPACE_STRUCTURE)) {
  contentByPath[normalizePath(path.join(SFDX_WORKSPACE_ROOT, rel.replaceAll('\\', '/')))] = content as string;
}
const fileStat = {
  type: 'file' as const,
  exists: true,
  ctime: 0,
  mtime: 0,
  size: 0
};

beforeAll(() => {
  jest.spyOn(sfdxFileSystemAccessor, 'getFileStat').mockImplementation(async (uri: string) => {
    const key = normalizePath(uri);
    return key in contentByPath ? fileStat : undefined;
  });
  jest.spyOn(sfdxFileSystemAccessor, 'getFileContent').mockImplementation(async (uri: string) => {
    const key = normalizePath(uri);
    return contentByPath[key];
  });
});

const componentIndexer: ComponentIndexer = new ComponentIndexer({
  workspaceRoot: SFDX_WORKSPACE_ROOT,
  fileSystemAccessor: sfdxFileSystemAccessor
});
const attributes: DataProviderAttributes = {
  indexer: componentIndexer
};
const provider = new LWCDataProvider(attributes);

beforeEach(async () => {
  await componentIndexer.init();
});

describe('provideValues()', () => {
  it('should return a list of values', () => {
    const values = provider.provideValues();
    const names = values.map(value => value.name);
    expect(values).not.toBeEmpty();
    // Values come from disk-discovered components (e.g. todo_item has @api todo, sameLine, nextLine)
    expect(names).toInclude('todo');
    expect(names).toInclude('sameLine');
  });

  it('should validate an empty array is returned when tag.classMembers is undefined', async () => {
    // The setting of the TagAttrs's file property needs to be delayed. It needs to be undefined
    // when passed into the ctor(), and then we'll manually set it afterwards.
    const tagAttrs: TagAttrs = {
      file: undefined,
      metadata: {
        decorators: [],
        exports: []
      },
      updatedAt: undefined
    };
    const tag = await createTag(tagAttrs);
    tag.file = 'path/to/some-file';

    const componentIndexr = new ComponentIndexer({
      workspaceRoot: SFDX_WORKSPACE_ROOT,
      fileSystemAccessor: sfdxFileSystemAccessor
    });
    componentIndexr.tags.set(getTagName(tag), tag);

    const providr = new LWCDataProvider({
      indexer: componentIndexr
    });

    const values = providr.provideValues();
    expect(values).toEqual([]);
  });
});

describe('provideAttributes()', () => {
  it('should return a set list of attributes for template tag', () => {
    const attributs = provider.provideAttributes('template');
    expect(attributs).not.toBeEmpty();
    expect(attributs).toBeArrayOfSize(9);
    expect(attributs[0].name).toEqual('for:each');
    expect(attributs[1].name).toEqual('for:item');
    expect(attributs[2].name).toEqual('for:index');
    expect(attributs[3].name).toEqual('if:true');
    expect(attributs[4].name).toEqual('if:false');
    expect(attributs[5].name).toEqual('lwc:if');
    expect(attributs[6].name).toEqual('lwc:elseif');
    expect(attributs[7].name).toEqual('lwc:else');
    expect(attributs[8].name).toEqual('iterator:it');
  });
});
