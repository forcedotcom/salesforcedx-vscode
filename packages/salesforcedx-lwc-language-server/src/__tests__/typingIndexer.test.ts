/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SFDX_WORKSPACE_ROOT, sfdxFileSystemProvider } from '@salesforce/salesforcedx-lightning-lsp-common/src/__tests__/testUtils';
import * as path from 'node:path';
import TypingIndexer, { pathBasename } from '../typingIndexer';

let typingIndexer: TypingIndexer;

describe('TypingIndexer', () => {
    beforeAll(async () => {
        typingIndexer = await TypingIndexer.create(
            {
                workspaceRoot: SFDX_WORKSPACE_ROOT,
            },
            sfdxFileSystemProvider,
        );
    });

    afterEach(async () => {
        // Clear the file system provider data for the typings directory
        sfdxFileSystemProvider.updateFileContent(`${typingIndexer.typingsBaseDir}`, '');
    });

    describe('new', () => {
        it('initializes with the root of a workspace', async () => {
            const expectedPath: string = SFDX_WORKSPACE_ROOT;
            expect(typingIndexer.workspaceRoot).toEqual(expectedPath);
            expect(await typingIndexer.getSfdxPackageDirsPattern()).toEqual('{force-app,utils,registered-empty-folder}');
        });
    });

    describe('#createNewMetaTypings', () => {
        it('saves the meta files as t.ds files', async () => {
            await typingIndexer.createNewMetaTypings();
            const filepaths: string[] = ['Channel1.messageChannel.d.ts', 'bike_assets.resource.d.ts', 'logo.asset.d.ts', 'todocss.resource.d.ts'];

            for (const filename of filepaths) {
                const filepath = path.join(typingIndexer.typingsBaseDir, filename);
                const exists = sfdxFileSystemProvider.fileExists(`${filepath}`);
                expect(exists).toBeTrue();
            }
        });
    });

    describe('#removeStaleTypings', () => {
        it('saves the meta files as t.ds files', async () => {
            const typing: string = path.join(typingIndexer.typingsBaseDir, 'logo.resource.d.ts');
            const staleTyping: string = path.join(typingIndexer.typingsBaseDir, 'extra.resource.d.ts');

            sfdxFileSystemProvider.updateDirectoryListing(`${typingIndexer.typingsBaseDir}`, []);
            sfdxFileSystemProvider.updateFileContent(`${typing}`, 'foobar');
            sfdxFileSystemProvider.updateFileContent(`${staleTyping}`, 'foobar');

            await typingIndexer.deleteStaleMetaTypings();

            expect(sfdxFileSystemProvider.fileExists(`${typing}`)).toBeTrue();
            expect(sfdxFileSystemProvider.fileExists(`${staleTyping}`)).toBeFalse();
        });
    });

    describe('#saveCustomLabelTypings', () => {
        afterEach(async () => {
            sfdxFileSystemProvider.updateFileContent(`${typingIndexer.typingsBaseDir}`, '');
        });

        it('saves the custom labels xml file to 1 typings file', async () => {
            await typingIndexer.saveCustomLabelTypings();
            const customLabelPath: string = path.join(typingIndexer.workspaceRoot, '.sfdx', 'typings', 'lwc', 'customlabels.d.ts');
            expect(sfdxFileSystemProvider.fileExists(`${customLabelPath}`)).toBeTrue();
            const content = sfdxFileSystemProvider.getFileContent(`${customLabelPath}`);
            expect(content).toInclude('declare module');
        });

        it('should not create a customlabels typing file when a project has no custom labels', async () => {
            // Mock the getCustomLabelFiles function to return empty array (no custom labels)
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            jest.spyOn(require('../typingIndexer'), 'getCustomLabelFiles').mockReturnValue([]);

            const updateFileContentSpy = jest.spyOn(sfdxFileSystemProvider, 'updateFileContent');
            await typingIndexer.saveCustomLabelTypings();
            expect(updateFileContentSpy).not.toHaveBeenCalled();
        });
    });

    describe('#metaFilePaths', () => {
        test('it returns all the paths of meta files', () => {
            const metaFilePaths: string[] = typingIndexer.metaFiles.sort();
            const expectedMetaFilePaths: string[] = [
                path.join(SFDX_WORKSPACE_ROOT, 'force-app/main/default/contentassets/logo.asset-meta.xml'),
                path.join(SFDX_WORKSPACE_ROOT, 'force-app/main/default/messageChannels/Channel1.messageChannel-meta.xml'),
                path.join(SFDX_WORKSPACE_ROOT, 'force-app/main/default/messageChannels/Channel2.messageChannel-meta.xml'),
                path.join(SFDX_WORKSPACE_ROOT, 'force-app/main/default/staticresources/bike_assets.resource-meta.xml'),
                path.join(SFDX_WORKSPACE_ROOT, 'force-app/main/default/staticresources/logo.resource-meta.xml'),
                path.join(SFDX_WORKSPACE_ROOT, 'force-app/main/default/staticresources/todocss.resource-meta.xml'),
                path.join(SFDX_WORKSPACE_ROOT, 'utils/meta/staticresources/todoutil.resource-meta.xml'),
            ].sort();

            expect(metaFilePaths).toEqual(expectedMetaFilePaths);
        });
    });

    describe('#metaTypings', () => {
        test("it returns all the paths for meta files' typings", async () => {
            sfdxFileSystemProvider.updateDirectoryListing(`${path.join(typingIndexer.typingsBaseDir, 'staticresources')}`, []);
            sfdxFileSystemProvider.updateDirectoryListing(`${path.join(typingIndexer.typingsBaseDir, 'messageChannels')}`, []);
            sfdxFileSystemProvider.updateDirectoryListing(`${path.join(typingIndexer.typingsBaseDir, 'contentassets')}`, []);

            const expectedMetaFileTypingPaths: string[] = [
                '.sfdx/typings/lwc/logo.asset.d.ts',
                '.sfdx/typings/lwc/Channel1.messageChannel.d.ts',
                '.sfdx/typings/lwc/bike_assets.resource.d.ts',
                '.sfdx/typings/lwc/todocss.resource.d.ts',
            ].map((item) => path.resolve(`${typingIndexer.workspaceRoot}/${item}`));

            for (const filePath of expectedMetaFileTypingPaths) {
                sfdxFileSystemProvider.updateFileContent(`${filePath}`, 'foobar');
            }

            const metaFilePaths: string[] = typingIndexer.metaTypings;

            expectedMetaFileTypingPaths.forEach((expectedPath) => {
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
                'utils/meta/staticresources/todoutil.resource-meta.xml',
            ];

            const list2: string[] = [
                '.sfdx/typings/lwc/Channel1.messageChannel.d.ts',
                '.sfdx/typings/lwc/bike_assets.resource.d.ts',
                '.sfdx/typings/lwc/logo.resource.d.ts',
                '.sfdx/typings/lwc/todocss.resource.d.ts',
                '.sfdx/typings/lwc/foobar.resource.d.ts',
            ];

            expect(TypingIndexer.diff(list1, list2)).toEqual([
                'force-app/main/default/messageChannels/Channel2.messageChannel-meta.xml',
                'utils/meta/staticresources/todoutil.resource-meta.xml',
            ]);

            expect(TypingIndexer.diff(list2, list1)).toEqual(['.sfdx/typings/lwc/foobar.resource.d.ts']);
        });
    });
});
