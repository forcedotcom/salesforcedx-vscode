/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FileSystemDataProvider } from '../providers/fileSystemDataProvider';
import { detectWorkspaceType } from '../shared';

describe('detectWorkspaceType', () => {
    test('when an sfdx-project.json file is present, workspaceType is SFDX', async () => {
        const fileSystemProvider = new FileSystemDataProvider();
        fileSystemProvider.updateFileStat('workspacedir/sfdx-project.json', {
            type: 'file',
            exists: true,
            ctime: 0,
            mtime: 0,
            size: 0,
        });

        const workspaceType = await detectWorkspaceType(['workspacedir'], fileSystemProvider);

        expect(workspaceType).toEqual('SFDX');
    });

    test('when an lwc.config.json file is present, workspaceType is STANDARD_LWC', async () => {
        const fileSystemProvider = new FileSystemDataProvider();
        fileSystemProvider.updateFileStat('workspacedir/lwc.config.json', {
            type: 'file',
            exists: true,
            ctime: 0,
            mtime: 0,
            size: 0,
        });

        const workspaceType = await detectWorkspaceType(['workspacedir'], fileSystemProvider);

        expect(workspaceType).toEqual('STANDARD_LWC');
    });

    test('when workspace-user.xml file is present at the root, workspaceType is CORE_ALL', async () => {
        const fileSystemProvider = new FileSystemDataProvider();
        fileSystemProvider.updateFileStat('workspacedir/workspace-user.xml', {
            type: 'file',
            exists: true,
            ctime: 0,
            mtime: 0,
            size: 0,
        });

        const workspaceType = await detectWorkspaceType(['workspacedir'], fileSystemProvider);

        expect(workspaceType).toEqual('CORE_ALL');
    });

    test('when workspace-user.xml file is present at the parent of the root, workspaceType is CORE_PARTIAL', async () => {
        const fileSystemProvider = new FileSystemDataProvider();
        fileSystemProvider.updateFileStat('workspace-user.xml', {
            type: 'file',
            exists: true,
            ctime: 0,
            mtime: 0,
            size: 0,
        });
        const workspaceType = await detectWorkspaceType(['workspacedir'], fileSystemProvider);
        expect(workspaceType).toEqual('CORE_PARTIAL');
    });

    test('when package.json dependencies includes @lwc/engine-dom, workspaceType is STANDARD_LWC', async () => {
        const fileSystemProvider = new FileSystemDataProvider();
        fileSystemProvider.updateFileStat('workspacedir/package.json', {
            type: 'file',
            exists: true,
            ctime: 0,
            mtime: 0,
            size: 0,
        });
        void fileSystemProvider.updateFileContent(
            'workspacedir/package.json',
            JSON.stringify({
                dependencies: {
                    '@lwc/engine-dom': 1,
                },
            }),
        );

        const workspaceType = await detectWorkspaceType(['workspacedir'], fileSystemProvider);

        expect(workspaceType).toEqual('STANDARD_LWC');
    });

    test('when package.json dependencies includes @lwc/<anything>, workspaceType is STANDARD_LWC', async () => {
        const fileSystemProvider = new FileSystemDataProvider();
        fileSystemProvider.updateFileStat('workspacedir/package.json', {
            type: 'file',
            exists: true,
            ctime: 0,
            mtime: 0,
            size: 0,
        });
        void fileSystemProvider.updateFileContent(
            'workspacedir/package.json',
            JSON.stringify({
                dependencies: {
                    '@lwc/compiler': 1,
                },
            }),
        );

        const workspaceType = await detectWorkspaceType(['workspacedir'], fileSystemProvider);

        expect(workspaceType).toEqual('STANDARD_LWC');
    });

    test('when package.json devDependencies includes @lwc/<anything>, workspaceType is STANDARD_LWC', async () => {
        const fileSystemProvider = new FileSystemDataProvider();
        fileSystemProvider.updateFileStat('workspacedir/package.json', {
            type: 'file',
            exists: true,
            ctime: 0,
            mtime: 0,
            size: 0,
        });
        void fileSystemProvider.updateFileContent(
            'workspacedir/package.json',
            JSON.stringify({
                devDependencies: {
                    '@lwc/compiler': 1,
                },
            }),
        );

        const workspaceType = await detectWorkspaceType(['workspacedir'], fileSystemProvider);

        expect(workspaceType).toEqual('STANDARD_LWC');
    });
    test('when package.json dependencies includes @lwc/engine-dom, workspaceType is STANDARD_LWC', async () => {
        const fileSystemProvider = new FileSystemDataProvider();
        fileSystemProvider.updateFileStat('workspacedir/package.json', {
            type: 'file',
            exists: true,
            ctime: 0,
            mtime: 0,
            size: 0,
        });
        void fileSystemProvider.updateFileContent(
            'workspacedir/package.json',
            JSON.stringify({
                dependencies: {
                    '@lwc/engine-dom': 1,
                },
            }),
        );
        const workspaceType = await detectWorkspaceType(['workspacedir'], fileSystemProvider);

        expect(workspaceType).toEqual('STANDARD_LWC');
    });

    test('when package.json devDependencies include @lwc/engine-dom, workspaceType is STANDARD_LWC', async () => {
        const fileSystemProvider = new FileSystemDataProvider();
        fileSystemProvider.updateFileStat('workspacedir/package.json', {
            type: 'file',
            exists: true,
            ctime: 0,
            mtime: 0,
            size: 0,
        });
        void fileSystemProvider.updateFileContent(
            'workspacedir/package.json',
            JSON.stringify({
                devDependencies: {
                    '@lwc/engine-dom': 1,
                },
            }),
        );
        const workspaceType = await detectWorkspaceType(['workspacedir'], fileSystemProvider);
        expect(workspaceType).toEqual('STANDARD_LWC');
    });

    test('when package.json dependencies includes `lwc`, workspaceType is STANDARD_LWC', async () => {
        const fileSystemProvider = new FileSystemDataProvider();
        fileSystemProvider.updateFileStat('workspacedir/package.json', {
            type: 'file',
            exists: true,
            ctime: 0,
            mtime: 0,
            size: 0,
        });
        void fileSystemProvider.updateFileContent(
            'workspacedir/package.json',
            JSON.stringify({
                dependencies: {
                    lwc: 1,
                },
            }),
        );
        const workspaceType = await detectWorkspaceType(['workspacedir'], fileSystemProvider);

        expect(workspaceType).toEqual('STANDARD_LWC');
    });

    test('when package.json devDependencies include `lwc`, workspaceType is STANDARD_LWC', async () => {
        const fileSystemProvider = new FileSystemDataProvider();
        fileSystemProvider.updateFileStat('workspacedir/package.json', {
            type: 'file',
            exists: true,
            ctime: 0,
            mtime: 0,
            size: 0,
        });
        void fileSystemProvider.updateFileContent(
            'workspacedir/package.json',
            JSON.stringify({
                devDependencies: {
                    lwc: 1,
                },
            }),
        );
        const workspaceType = await detectWorkspaceType(['workspacedir'], fileSystemProvider);
        expect(workspaceType).toEqual('STANDARD_LWC');
    });

    test('when package.json has `lwc` configuration', async () => {
        const fileSystemProvider = new FileSystemDataProvider();
        fileSystemProvider.updateFileStat('workspacedir/package.json', {
            type: 'file',
            exists: true,
            ctime: 0,
            mtime: 0,
            size: 0,
        });
        void fileSystemProvider.updateFileContent(
            'workspacedir/package.json',
            JSON.stringify({
                lwc: {
                    mapNamespaceFromPath: true,
                    modules: ['src/main/modules'],
                },
            }),
        );

        const workspaceType = await detectWorkspaceType(['workspacedir'], fileSystemProvider);
        expect(workspaceType).toEqual('STANDARD_LWC');
    });

    test('when package.json specifies workspaces, workspaceType is MONOREPO', async () => {
        const fileSystemProvider = new FileSystemDataProvider();
        fileSystemProvider.updateFileStat('workspacedir/package.json', {
            type: 'file',
            exists: true,
            ctime: 0,
            mtime: 0,
            size: 0,
        });
        void fileSystemProvider.updateFileContent(
            'workspacedir/package.json',
            JSON.stringify({
                workspaces: [],
            }),
        );

        const workspaceType = await detectWorkspaceType(['workspacedir'], fileSystemProvider);

        expect(workspaceType).toEqual('MONOREPO');
    });

    test('when lerna.json exists in project, workspaceType is MONOREPO', async () => {
        const fileSystemProvider = new FileSystemDataProvider();
        fileSystemProvider.updateFileStat('workspacedir/package.json', {
            type: 'file',
            exists: true,
            ctime: 0,
            mtime: 0,
            size: 0,
        });
        fileSystemProvider.updateFileStat('workspacedir/lerna.json', {
            type: 'file',
            exists: true,
            ctime: 0,
            mtime: 0,
            size: 0,
        });
        void fileSystemProvider.updateFileContent('workspacedir/package.json', '{}');
        void fileSystemProvider.updateFileContent('workspacedir/lerna.json', '{}');

        const workspaceType = await detectWorkspaceType(['workspacedir'], fileSystemProvider);

        expect(workspaceType).toEqual('MONOREPO');
    });

    test('when package.json exists but no other conditions met, workspaceType is STANDARD', async () => {
        const fileSystemProvider = new FileSystemDataProvider();
        fileSystemProvider.updateFileStat('workspacedir/package.json', {
            type: 'file',
            exists: true,
            ctime: 0,
            mtime: 0,
            size: 0,
        });
        void fileSystemProvider.updateFileContent('workspacedir/package.json', '{}');

        const workspaceType = await detectWorkspaceType(['workspacedir'], fileSystemProvider);

        expect(workspaceType).toEqual('STANDARD');
    });

    test('when no package.json, workspace-user.xml or sfdx-project.json, workspaceType is UNKNOWN', async () => {
        const workspaceType = await detectWorkspaceType(['workspacedir'], new FileSystemDataProvider());

        expect(workspaceType).toEqual('UNKNOWN');
    });
});

describe('detectWorkspaceType with mutliroot', () => {
    test('when all projects are CORE_PARTIAL, workspaceType is CORE_PARTIAL', async () => {
        const fileSystemProvider = new FileSystemDataProvider();
        fileSystemProvider.updateFileStat('workspace-user.xml', {
            type: 'file',
            exists: true,
            ctime: 0,
            mtime: 0,
            size: 0,
        });

        const workspaceType = await detectWorkspaceType(['workspacedir', 'workspacedir2'], fileSystemProvider);

        expect(workspaceType).toEqual('CORE_PARTIAL');
    });

    // TODO: This will be invalid once we fix the logic to resolve against multiple project types.
    test('when none of the projects are CORE_PARTIAL, workspaceType is UNKNOWN', async () => {
        const workspaceType = await detectWorkspaceType(['sfdx_workspace', 'core_all_workspace', 'standard_lwc_workspace'], new FileSystemDataProvider());

        expect(workspaceType).toEqual('UNKNOWN');
    });

    // TODO: This will be invalid once we fix the logic to resolve against multiple project types.
    test('when not all of the projects are CORE_PARTIAL, workspaceType is UNKNOWN', async () => {
        const workspaceType = await detectWorkspaceType(
            ['sfdx_workspace', 'core_all_workspace', 'standard_lwc_workspace', 'core_partial_workspace'],
            new FileSystemDataProvider(),
        );

        expect(workspaceType).toEqual('UNKNOWN');
    });
});
