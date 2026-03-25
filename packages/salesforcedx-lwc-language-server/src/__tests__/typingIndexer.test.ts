/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { normalizePath } from '@salesforce/salesforcedx-lightning-lsp-common';
import {
  buildSfdxContentMap,
  DIR_STAT,
  FILE_STAT,
  SFDX_WORKSPACE_ROOT,
  SFDX_WORKSPACE_STRUCTURE,
  sfdxFileSystemAccessor
} from '@salesforce/salesforcedx-lightning-lsp-common/testUtils';
import { Minimatch } from 'minimatch';
import * as path from 'node:path';
import { getSfdxPackageDirsPattern } from '../baseIndexer';
import * as typingIndexerModule from '../typingIndexer';
import TypingIndexer, { getMetaTypings, pathBasename } from '../typingIndexer';

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

describe('TypingIndexer', () => {
  beforeAll(async () => {
    const contentMap = buildSfdxContentMap();
    const root = normalizePath(SFDX_WORKSPACE_ROOT);
    for (const [rel, content] of Object.entries(SFDX_WORKSPACE_STRUCTURE as Record<string, string>)) {
      contentMap.set(normalizePath(path.join(root, rel.replaceAll('\\', '/'))), content);
    }
    for (const rel of META_FILE_REL_PATHS) {
      contentMap.set(normalizePath(path.join(root, rel)), '');
    }
    contentMap.set(
      normalizePath(path.join(root, 'force-app/main/default/labels/CustomLabels.labels-meta.xml')),
      CUSTOM_LABELS_XML
    );

    jest
      .spyOn(sfdxFileSystemAccessor, 'findFilesWithGlobAsync')
      .mockImplementation((pattern: string, folder: string) => {
        const basePath = normalizePath(folder);
        const mm = new Minimatch(pattern, { dot: true });
        const prefix = `${basePath}/`;
        const matching = [...contentMap.keys()].filter(absPath => {
          if (!absPath.startsWith(prefix)) return false;
          return mm.match(absPath.slice(prefix.length));
        });
        return Promise.resolve(matching.map(normalizePath));
      });

    jest
      .spyOn(sfdxFileSystemAccessor, 'getFileContent')
      .mockImplementation((uri: string) => Promise.resolve(contentMap.get(normalizePath(uri))));
    jest.spyOn(sfdxFileSystemAccessor, 'getFileStat').mockImplementation((uri: string) => {
      const key = normalizePath(uri);
      if (contentMap.has(key)) return Promise.resolve(FILE_STAT);
      const prefix = `${key}/`;
      for (const k of contentMap.keys()) {
        if (k.startsWith(prefix)) return Promise.resolve(DIR_STAT);
      }
      return Promise.resolve(undefined);
    });
    jest.spyOn(sfdxFileSystemAccessor, 'updateFileContent').mockImplementation(async (uri: string, content: string) => {
      contentMap.set(normalizePath(uri), content);
    });
    jest.spyOn(sfdxFileSystemAccessor, 'deleteFile').mockImplementation(async (pathOrUri: string) => {
      contentMap.delete(normalizePath(pathOrUri));
    });

    typingIndexer = await TypingIndexer.create(
      {
        workspaceRoot: SFDX_WORKSPACE_ROOT
      },
      sfdxFileSystemAccessor
    );
  });

  describe('new', () => {
    it('initializes with the root of a workspace', async () => {
      // workspaceRoot is normalized by getWorkspaceRoot, so normalize the expected path for comparison
      expect(typingIndexer.workspaceRoot).toEqual(SFDX_WORKSPACE_ROOT);
      await expect(
        getSfdxPackageDirsPattern(typingIndexer.workspaceRoot, sfdxFileSystemAccessor)
      ).resolves.toEqual('{force-app,utils,registered-empty-folder}');
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
