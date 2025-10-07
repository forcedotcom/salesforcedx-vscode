/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import TypingIndexer, { pathBasename } from '../typing-indexer';

const typingIndexer: TypingIndexer = new TypingIndexer({
    workspaceRoot: path.resolve('..', '..', 'test-workspaces', 'sfdx-workspace'),
});

// This is required in order to spyOn fs functions in newer versions of
// jest and ts-jest. Solution adapted from Jest docs here:
// https://jestjs.io/docs/jest-object
jest.mock('fs', () => ({
    __esModule: true,
    ...jest.requireActual('fs'),
}));

describe('TypingIndexer', () => {
    afterEach(() => {
        if (fs.existsSync(typingIndexer.typingsBaseDir)) {
            fs.rmSync(typingIndexer.typingsBaseDir, { recursive: true, force: true });
        }
    });

    describe('new', () => {
        it('initializes with the root of a workspace', () => {
            const expectedPath: string = path.resolve('../../test-workspaces/sfdx-workspace');
            expect(typingIndexer.workspaceRoot).toEqual(expectedPath);
            expect(typingIndexer.sfdxPackageDirsPattern).toEqual('{force-app,utils,registered-empty-folder}');
        });
    });

    describe('#createNewMetaTypings', () => {
        it('saves the meta files as t.ds files', async () => {
            typingIndexer.createNewMetaTypings();
            const filepaths: string[] = ['Channel1.messageChannel.d.ts', 'bike_assets.resource.d.ts', 'logo.asset.d.ts', 'todocss.resource.d.ts'];

            filepaths.forEach((filepath) => {
                filepath = path.join(typingIndexer.typingsBaseDir, filepath);
                expect(fs.existsSync(filepath)).toBeTrue();
            });
        });
    });

    describe('#removeStaleTypings', () => {
        it('saves the meta files as t.ds files', async () => {
            const typing: string = path.join(typingIndexer.typingsBaseDir, 'logo.resource.d.ts');
            const staleTyping: string = path.join(typingIndexer.typingsBaseDir, 'extra.resource.d.ts');

            fs.mkdirSync(typingIndexer.typingsBaseDir, { recursive: true });
            fs.writeFileSync(typing, 'foobar');
            fs.writeFileSync(staleTyping, 'foobar');

            typingIndexer.deleteStaleMetaTypings();

            expect(fs.existsSync(typing)).toBeTrue();
            expect(fs.existsSync(staleTyping)).toBeFalse();
        });
    });

    describe('#saveCustomLabelTypings', () => {
        afterEach(() => {
            if (fs.existsSync(typingIndexer.typingsBaseDir)) {
                fs.rmSync(typingIndexer.typingsBaseDir, { recursive: true, force: true });
            }
            jest.restoreAllMocks();
        });

        it('saves the custom labels xml file to 1 typings file', async () => {
            await typingIndexer.saveCustomLabelTypings();
            const customLabelPath: string = path.join(typingIndexer.workspaceRoot, '.sfdx', 'typings', 'lwc', 'customlabels.d.ts');
            expect(fs.existsSync(customLabelPath)).toBeTrue();
            expect(fs.readFileSync(customLabelPath).toString()).toInclude('declare module');
        });

        it('should not create a customlabels typing file when a project has no custom labels', async () => {
            // Mock the getCustomLabelFiles function to return empty array (no custom labels)
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            jest.spyOn(require('../typing-indexer'), 'getCustomLabelFiles').mockReturnValue([]);

            const fileWriter = jest.spyOn(fs, 'writeFileSync');
            await typingIndexer.saveCustomLabelTypings();
            expect(fileWriter).not.toHaveBeenCalled();
        });
    });

    describe('#metaFilePaths', () => {
        test('it returns all the paths  for meta files', () => {
            const metaFilePaths: string[] = typingIndexer.metaFiles.sort();
            const expectedMetaFilePaths: string[] = [
                '../../test-workspaces/sfdx-workspace/force-app/main/default/contentassets/logo.asset-meta.xml',
                '../../test-workspaces/sfdx-workspace/force-app/main/default/messageChannels/Channel1.messageChannel-meta.xml',
                '../../test-workspaces/sfdx-workspace/force-app/main/default/messageChannels/Channel2.messageChannel-meta.xml',
                '../../test-workspaces/sfdx-workspace/force-app/main/default/staticresources/bike_assets.resource-meta.xml',
                '../../test-workspaces/sfdx-workspace/force-app/main/default/staticresources/todocss.resource-meta.xml',
                '../../test-workspaces/sfdx-workspace/utils/meta/staticresources/todoutil.resource-meta.xml',
            ]
                .map((filename) => path.resolve(filename))
                .sort();

            expect(metaFilePaths).toEqual(expectedMetaFilePaths);
        });
    });

    describe('#metaTypings', () => {
        test("it returns all the paths for meta files' typings", () => {
            fs.mkdirSync(path.join(typingIndexer.typingsBaseDir, 'staticresources'), { recursive: true });
            fs.mkdirSync(path.join(typingIndexer.typingsBaseDir, 'messageChannels'), { recursive: true });
            fs.mkdirSync(path.join(typingIndexer.typingsBaseDir, 'contentassets'), { recursive: true });

            const expectedMetaFileTypingPaths: string[] = [
                '.sfdx/typings/lwc/logo.asset.d.ts',
                '.sfdx/typings/lwc/Channel1.messageChannel.d.ts',
                '.sfdx/typings/lwc/bike_assets.resource.d.ts',
                '.sfdx/typings/lwc/todocss.resource.d.ts',
            ].map((item) => path.resolve(`${typingIndexer.workspaceRoot}/${item}`));

            expectedMetaFileTypingPaths.forEach((filePath: string) => {
                fs.writeFileSync(filePath, 'foobar');
            });

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
