/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
    readAsTextDocument,
    FORCE_APP_ROOT,
    UTILS_ROOT,
    REGISTERED_EMPTY_FOLDER_ROOT,
    SFDX_WORKSPACE_ROOT,
    sfdxFileSystemProvider,
} from '@salesforce/salesforcedx-lightning-lsp-common/testUtils';
import { join, resolve } from 'node:path';
import { LWCWorkspaceContext } from '../context/lwcContext';

describe('LWCWorkspaceContext', () => {
    it('isLWCJavascript()', async () => {
        const context = new LWCWorkspaceContext([SFDX_WORKSPACE_ROOT], sfdxFileSystemProvider);
        await context.initialize();

        // lwc .js
        let document = readAsTextDocument(join(FORCE_APP_ROOT, 'lwc', 'hello_world', 'hello_world.js'), sfdxFileSystemProvider);
        expect(await context.isLWCJavascript(document)).toBeTruthy();

        // lwc .htm
        document = readAsTextDocument(join(FORCE_APP_ROOT, 'lwc', 'hello_world', 'hello_world.html'), sfdxFileSystemProvider);
        expect(await context.isLWCJavascript(document)).toBeFalsy();

        // aura cmps
        document = readAsTextDocument(join(FORCE_APP_ROOT, 'aura', 'helloWorldApp', 'helloWorldApp.app'), sfdxFileSystemProvider);
        expect(await context.isLWCJavascript(document)).toBeFalsy();

        // .js outside namespace roots
        document = readAsTextDocument(join(FORCE_APP_ROOT, 'aura', 'todoApp', 'randomJsInAuraFolder.js'), sfdxFileSystemProvider);
        expect(await context.isLWCJavascript(document)).toBeFalsy();

        // lwc .js in utils
        document = readAsTextDocument(join(UTILS_ROOT, 'lwc', 'todo_util', 'todo_util.js'), sfdxFileSystemProvider);
        expect(await context.isLWCJavascript(document)).toBeTruthy();
    });

    it('configureProjectForTs()', async () => {
        const context = new LWCWorkspaceContext([SFDX_WORKSPACE_ROOT], sfdxFileSystemProvider);
        await context.initialize();
        const baseTsconfigPathForceApp = resolve(join(SFDX_WORKSPACE_ROOT, '.sfdx', 'tsconfig.sfdx.json'));
        const tsconfigPathForceApp = resolve(join(FORCE_APP_ROOT, 'lwc', 'tsconfig.json'));
        const tsconfigPathUtils = resolve(join(UTILS_ROOT, 'lwc', 'tsconfig.json'));
        const tsconfigPathRegisteredEmpty = resolve(join(REGISTERED_EMPTY_FOLDER_ROOT, 'lwc', 'tsconfig.json'));
        const forceignorePath = resolve(join(SFDX_WORKSPACE_ROOT, '.forceignore'));

        // configure and verify typings/jsconfig after configuration:
        await context.configureProjectForTs();

        // verify forceignore
        const forceignoreBuffer = sfdxFileSystemProvider.getFileContent(forceignorePath);
        if (!forceignoreBuffer) {
            throw new Error('Forceignore file not found');
        }
        const forceignoreContent = Buffer.from(forceignoreBuffer).toString('utf8');
        expect(forceignoreContent).toContain('**/tsconfig.json');
        expect(forceignoreContent).toContain('**/*.ts');

        // verify tsconfig.sfdx.json
        const baseTsConfigBuffer = sfdxFileSystemProvider.getFileContent(baseTsconfigPathForceApp);
        if (!baseTsConfigBuffer) {
            throw new Error('Base tsconfig file not found');
        }
        const baseTsConfigForceAppContent = JSON.parse(baseTsConfigBuffer);
        expect(baseTsConfigForceAppContent).toEqual({
            compilerOptions: {
                module: 'NodeNext',
                skipLibCheck: true,
                target: 'ESNext',
                paths: {
                    'c/*': [],
                },
            },
        });

        //verify newly create tsconfig.json
        const tsconfigBuffer = sfdxFileSystemProvider.getFileContent(tsconfigPathForceApp);
        if (!tsconfigBuffer) {
            throw new Error('Tsconfig file not found');
        }
        const tsconfigForceAppContent = JSON.parse(Buffer.from(tsconfigBuffer).toString('utf8'));
        expect(tsconfigForceAppContent).toEqual({
            extends: '../../../../.sfdx/tsconfig.sfdx.json',
            include: ['**/*.ts', '../../../../.sfdx/typings/lwc/**/*.d.ts'],
            exclude: ['**/__tests__/**'],
        });

        // clean up artifacts
        sfdxFileSystemProvider.updateFileStat(baseTsconfigPathForceApp, {
            type: 'file',
            exists: false,
            ctime: 0,
            mtime: 0,
            size: 0,
        });
        sfdxFileSystemProvider.updateFileStat(tsconfigPathForceApp, {
            type: 'file',
            exists: false,
            ctime: 0,
            mtime: 0,
            size: 0,
        });
        sfdxFileSystemProvider.updateFileStat(tsconfigPathUtils, {
            type: 'file',
            exists: false,
            ctime: 0,
            mtime: 0,
            size: 0,
        });
        sfdxFileSystemProvider.updateFileStat(tsconfigPathRegisteredEmpty, {
            type: 'file',
            exists: false,
            ctime: 0,
            mtime: 0,
            size: 0,
        });
        sfdxFileSystemProvider.updateFileStat(forceignorePath, {
            type: 'file',
            exists: false,
            ctime: 0,
            mtime: 0,
            size: 0,
        });
    });
});
