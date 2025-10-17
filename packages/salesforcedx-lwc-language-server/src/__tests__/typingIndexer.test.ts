/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SFDX_WORKSPACE_ROOT } from '@salesforce/salesforcedx-lightning-lsp-common/src/__tests__/testUtils';
import * as path from 'node:path';
import * as vscode from 'vscode';
import TypingIndexer, { pathBasename } from '../typingIndexer';

// Helper functions for async file operations
const checkFileExists = async (filePath: string): Promise<boolean> => {
    try {
        await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
        return true;
    } catch {
        return false;
    }
};

const removeDirectoryIfExists = async (dirPath: string): Promise<void> => {
    try {
        await vscode.workspace.fs.delete(vscode.Uri.file(dirPath), { recursive: true });
    } catch {
        // Ignore if directory doesn't exist
    }
};

const createDirectory = async (dirPath: string): Promise<void> => {
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirPath));
};

const writeFile = async (filePath: string, content: string): Promise<void> => {
    await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), new TextEncoder().encode(content));
};

const readFile = async (filePath: string): Promise<string> => {
    const fileBuffer = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
    return Buffer.from(fileBuffer).toString('utf8');
};

let typingIndexer: TypingIndexer;

// Mock vscode.workspace.fs.readFile to return proper content for sfdx-project.json
const originalReadFile = vscode.workspace.fs.readFile;
jest.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async (uri) => {
    if (uri?.path?.includes('sfdx-project.json')) {
        const mockContent = JSON.stringify({
            packageDirectories: [{ path: 'force-app', default: true }, { path: 'utils' }, { path: 'registered-empty-folder' }],
            namespace: '',
            sfdcLoginUrl: 'https://mobile1.t.salesforce.com',
            signupTargetLoginUrl: 'https://mobile1.t.salesforce.com',
            sourceApiVersion: '42.0',
        });
        return new TextEncoder().encode(mockContent);
    }
    // For other files, call the original function
    return originalReadFile(uri);
});

describe('TypingIndexer', () => {
    beforeAll(async () => {
        typingIndexer = await TypingIndexer.create({
            workspaceRoot: SFDX_WORKSPACE_ROOT,
        });
    });

    afterEach(async () => {
        await removeDirectoryIfExists(typingIndexer.typingsBaseDir);
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
                const exists = await checkFileExists(filepath);
                expect(exists).toBeTrue();
            }
        });
    });

    describe('#removeStaleTypings', () => {
        it('saves the meta files as t.ds files', async () => {
            const typing: string = path.join(typingIndexer.typingsBaseDir, 'logo.resource.d.ts');
            const staleTyping: string = path.join(typingIndexer.typingsBaseDir, 'extra.resource.d.ts');

            await createDirectory(typingIndexer.typingsBaseDir);
            await writeFile(typing, 'foobar');
            await writeFile(staleTyping, 'foobar');

            await typingIndexer.deleteStaleMetaTypings();

            expect(await checkFileExists(typing)).toBeTrue();
            expect(await checkFileExists(staleTyping)).toBeFalse();
        });
    });

    describe('#saveCustomLabelTypings', () => {
        afterEach(async () => {
            await removeDirectoryIfExists(typingIndexer.typingsBaseDir);
            jest.restoreAllMocks();
        });

        it('saves the custom labels xml file to 1 typings file', async () => {
            await typingIndexer.saveCustomLabelTypings();
            const customLabelPath: string = path.join(typingIndexer.workspaceRoot, '.sfdx', 'typings', 'lwc', 'customlabels.d.ts');
            expect(await checkFileExists(customLabelPath)).toBeTrue();
            const content = await readFile(customLabelPath);
            expect(content).toInclude('declare module');
        });

        it('should not create a customlabels typing file when a project has no custom labels', async () => {
            // Mock the getCustomLabelFiles function to return empty array (no custom labels)
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            jest.spyOn(require('../typingIndexer'), 'getCustomLabelFiles').mockReturnValue([]);

            const fileWriter = jest.spyOn(vscode.workspace.fs, 'writeFile');
            await typingIndexer.saveCustomLabelTypings();
            expect(fileWriter).not.toHaveBeenCalled();
        });
    });

    describe('#metaFilePaths', () => {
        test('it returns all the paths of meta files', () => {
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
        test("it returns all the paths for meta files' typings", async () => {
            await createDirectory(path.join(typingIndexer.typingsBaseDir, 'staticresources'));
            await createDirectory(path.join(typingIndexer.typingsBaseDir, 'messageChannels'));
            await createDirectory(path.join(typingIndexer.typingsBaseDir, 'contentassets'));

            const expectedMetaFileTypingPaths: string[] = [
                '.sfdx/typings/lwc/logo.asset.d.ts',
                '.sfdx/typings/lwc/Channel1.messageChannel.d.ts',
                '.sfdx/typings/lwc/bike_assets.resource.d.ts',
                '.sfdx/typings/lwc/todocss.resource.d.ts',
            ].map((item) => path.resolve(`${typingIndexer.workspaceRoot}/${item}`));

            for (const filePath of expectedMetaFileTypingPaths) {
                await writeFile(filePath, 'foobar');
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
