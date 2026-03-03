/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { normalizePath } from '@salesforce/salesforcedx-lightning-lsp-common';
import {
  SFDX_WORKSPACE_ROOT,
  SFDX_WORKSPACE_STRUCTURE,
  sfdxFileSystemAccessor
} from '@salesforce/salesforcedx-lightning-lsp-common/testUtils';
import * as path from 'node:path';
import { getSfdxPackageDirsPattern } from '../baseIndexer';
import * as typingIndexerModule from '../typingIndexer';
import TypingIndexer, { getMetaTypings, pathBasename } from '../typingIndexer';

const FILE_STAT = { type: 'file' as const, exists: true, ctime: 0, mtime: 0, size: 0 };
const DIR_STAT = { type: 'directory' as const, exists: true, ctime: 0, mtime: 0, size: 0 };

const META_FILE_REL_PATHS = [
  'force-app/main/default/contentassets/logo.asset-meta.xml',
  'force-app/main/default/messageChannels/Channel1.messageChannel-meta.xml',
  'force-app/main/default/messageChannels/Channel2.messageChannel-meta.xml',
  'force-app/main/default/staticresources/bike_assets.resource-meta.xml',
  'force-app/main/default/staticresources/logo.resource-meta.xml',
  'force-app/main/default/staticresources/todocss.resource-meta.xml',
  'utils/meta/staticresources/todoutil.resource-meta.xml'
];

const CUSTOM_LABELS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">
  <labels>
    <fullName>TestLabel</fullName>
    <language>en_US</language>
    <value>Test</value>
  </labels>
</CustomLabels>`;

let typingIndexer: TypingIndexer;

function buildTypingIndexerContentMap(): Map<string, string> {
  const map = new Map<string, string>();
  const root = normalizePath(SFDX_WORKSPACE_ROOT);
  for (const [rel, content] of Object.entries(SFDX_WORKSPACE_STRUCTURE as Record<string, string>)) {
    map.set(normalizePath(path.join(root, rel.replaceAll('\\', '/'))), content);
  }
  for (const rel of META_FILE_REL_PATHS) {
    map.set(normalizePath(path.join(root, rel)), '');
  }
  map.set(
    normalizePath(path.join(root, 'force-app/main/default/labels/CustomLabels.labels-meta.xml')),
    CUSTOM_LABELS_XML
  );
  return map;
}

function mockSfdxAccessorForTypingIndexer(contentMap: Map<string, string>): void {
  jest
    .spyOn(sfdxFileSystemAccessor, 'getFileContent')
    .mockImplementation(async (uri: string) => contentMap.get(normalizePath(uri)));
  jest.spyOn(sfdxFileSystemAccessor, 'getFileStat').mockImplementation(async (uri: string) => {
    const key = normalizePath(uri);
    if (contentMap.has(key)) return FILE_STAT;
    const prefix = `${key}/`;
    for (const k of contentMap.keys()) {
      if (k.startsWith(prefix)) return DIR_STAT;
    }
    return undefined;
  });
  jest.spyOn(sfdxFileSystemAccessor, 'updateFileContent').mockImplementation(async (uri: string, content: string) => {
    contentMap.set(normalizePath(uri), content);
  });
  jest.spyOn(sfdxFileSystemAccessor, 'deleteFile').mockImplementation(async (pathOrUri: string) => {
    contentMap.delete(normalizePath(pathOrUri));
  });
}

describe('TypingIndexer', () => {
  beforeAll(async () => {
    const contentMap = buildTypingIndexerContentMap();
    mockSfdxAccessorForTypingIndexer(contentMap);
    typingIndexer = await TypingIndexer.create(
      {
        workspaceRoot: SFDX_WORKSPACE_ROOT
      },
      sfdxFileSystemAccessor
    );
  });

  afterEach(async () => {
    // Clear the file system provider data for the typings directory
    void sfdxFileSystemAccessor.updateFileContent(`${typingIndexer.typingsBaseDir}`, '');
  });

  describe('new', () => {
    it('initializes with the root of a workspace', async () => {
      // workspaceRoot is normalized by getWorkspaceRoot, so normalize the expected path for comparison
      expect(typingIndexer.workspaceRoot).toEqual(SFDX_WORKSPACE_ROOT);
      expect(await getSfdxPackageDirsPattern(typingIndexer.workspaceRoot, sfdxFileSystemAccessor)).toEqual(
        '{force-app,utils,registered-empty-folder}'
      );
    });
  });

  describe('#createNewMetaTypings', () => {
    it('saves the meta files as t.ds files', async () => {
      await typingIndexer.createNewMetaTypings();
      const filepaths: string[] = [
        'Channel1.messageChannel.d.ts',
        'bike_assets.resource.d.ts',
        'logo.asset.d.ts',
        'todocss.resource.d.ts'
      ];

      for (const filename of filepaths) {
        const filepath = path.join(typingIndexer.typingsBaseDir, filename);
        const exists = await sfdxFileSystemAccessor.fileExists(`${filepath}`);
        expect(exists).toBeTrue();
      }
    });
  });

  describe('#removeStaleTypings', () => {
    it('saves the meta files as t.ds files', async () => {
      const typing: string = path.join(typingIndexer.typingsBaseDir, 'logo.resource.d.ts');
      const staleTyping: string = path.join(typingIndexer.typingsBaseDir, 'extra.resource.d.ts');

      void sfdxFileSystemAccessor.updateFileContent(`${typing}`, 'foobar');
      void sfdxFileSystemAccessor.updateFileContent(`${staleTyping}`, 'foobar');

      const realGetMetaTypings = typingIndexerModule.getMetaTypings;
      jest.spyOn(typingIndexerModule, 'getMetaTypings').mockImplementation(async indexer => {
        const list = await realGetMetaTypings(indexer);
        list.push(path.resolve(indexer.typingsBaseDir, 'extra.resource.d.ts'));
        return list;
      });

      await typingIndexer.deleteStaleMetaTypings();

      expect(await sfdxFileSystemAccessor.fileExists(`${typing}`)).toBeTrue();
      expect(await sfdxFileSystemAccessor.fileExists(`${staleTyping}`)).toBeFalse();
    });
  });

  describe('#saveCustomLabelTypings', () => {
    afterEach(async () => {
      void sfdxFileSystemAccessor.updateFileContent(`${typingIndexer.typingsBaseDir}`, '');
    });

    it('saves the custom labels xml file to 1 typings file', async () => {
      await typingIndexer.saveCustomLabelTypings();
      const customLabelPath: string = path.join(
        typingIndexer.workspaceRoot,
        '.sfdx',
        'typings',
        'lwc',
        'customlabels.d.ts'
      );
      expect(await sfdxFileSystemAccessor.fileExists(`${customLabelPath}`)).toBeTrue();
      const content = await sfdxFileSystemAccessor.getFileContent(`${customLabelPath}`);
      expect(content).toInclude('declare module');
    });
  });

  describe('#metaFilePaths', () => {
    test('it returns all the paths of meta files', async () => {
      const metaFilePaths: string[] = typingIndexer.metaFiles.toSorted();
      // metaFilePaths are normalized, so normalize expected paths for comparison
      const expectedMetaFilePaths: string[] = [
        normalizePath(path.join(SFDX_WORKSPACE_ROOT, 'force-app/main/default/contentassets/logo.asset-meta.xml')),
        normalizePath(
          path.join(SFDX_WORKSPACE_ROOT, 'force-app/main/default/messageChannels/Channel1.messageChannel-meta.xml')
        ),
        normalizePath(
          path.join(SFDX_WORKSPACE_ROOT, 'force-app/main/default/messageChannels/Channel2.messageChannel-meta.xml')
        ),
        normalizePath(
          path.join(SFDX_WORKSPACE_ROOT, 'force-app/main/default/staticresources/bike_assets.resource-meta.xml')
        ),
        normalizePath(path.join(SFDX_WORKSPACE_ROOT, 'force-app/main/default/staticresources/logo.resource-meta.xml')),
        normalizePath(
          path.join(SFDX_WORKSPACE_ROOT, 'force-app/main/default/staticresources/todocss.resource-meta.xml')
        ),
        normalizePath(path.join(SFDX_WORKSPACE_ROOT, 'utils/meta/staticresources/todoutil.resource-meta.xml'))
      ].toSorted();

      expect(metaFilePaths).toEqual(expectedMetaFilePaths);
    });
  });

  describe('#metaTypings', () => {
    test("it returns all the paths for meta files' typings", async () => {
      const expectedMetaFileTypingPaths: string[] = [
        '.sfdx/typings/lwc/logo.asset.d.ts',
        '.sfdx/typings/lwc/Channel1.messageChannel.d.ts',
        '.sfdx/typings/lwc/bike_assets.resource.d.ts',
        '.sfdx/typings/lwc/todocss.resource.d.ts'
      ].map(item => path.resolve(`${typingIndexer.workspaceRoot}/${item}`));

      for (const filePath of expectedMetaFileTypingPaths) {
        void sfdxFileSystemAccessor.updateFileContent(`${filePath}`, 'foobar');
      }

      const metaFilePaths: string[] = await getMetaTypings(typingIndexer);

      expectedMetaFileTypingPaths.forEach(expectedPath => {
        expect(metaFilePaths).toContain(expectedPath);
      });
    });
  });

  describe('pathBasename', () => {
    it('returns the basename of a path', () => {
      expect(pathBasename('force-app/main/default/contentassets/logo.asset-meta.xml')).toEqual('logo');
      expect(pathBasename('force-app/main/default/contentassets/logo.asset.d.ts')).toEqual('logo');
      expect(pathBasename('force-app\\main\\default\\contentassets\\logo.asset.d.ts-meta.xml')).toEqual('logo');
      expect(pathBasename('force-app\\main\\default\\contentassets\\logo.asset.d.ts')).toEqual('logo');
    });
  });

  describe('.diff', () => {
    it('returns a list of strings that do not exist in the compare list', () => {
      const list1: string[] = [
        'force-app/main/default/contentassets/logo.asset-meta.xml',
        'force-app/main/default/messageChannels/Channel1.messageChannel-meta.xml',
        'force-app/main/default/messageChannels/Channel2.messageChannel-meta.xml',
        'force-app/main/default/staticresources/bike_assets.resource-meta.xml',
        'force-app/main/default/staticresources/todocss.resource-meta.xml',
        'utils/meta/staticresources/todoutil.resource-meta.xml'
      ];

      const list2: string[] = [
        '.sfdx/typings/lwc/Channel1.messageChannel.d.ts',
        '.sfdx/typings/lwc/bike_assets.resource.d.ts',
        '.sfdx/typings/lwc/logo.resource.d.ts',
        '.sfdx/typings/lwc/todocss.resource.d.ts',
        '.sfdx/typings/lwc/foobar.resource.d.ts'
      ];

      expect(TypingIndexer.diff(list1, list2)).toEqual([
        'force-app/main/default/messageChannels/Channel2.messageChannel-meta.xml',
        'utils/meta/staticresources/todoutil.resource-meta.xml'
      ]);

      expect(TypingIndexer.diff(list2, list1)).toEqual(['.sfdx/typings/lwc/foobar.resource.d.ts']);
    });
  });
});
