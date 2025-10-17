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
} from '@salesforce/salesforcedx-lightning-lsp-common/src/__tests__/testUtils';
import { join, resolve } from 'node:path';
import * as vscode from 'vscode';
import { LWCWorkspaceContext } from '../context/lwcContext';

describe('LWCWorkspaceContext', () => {
    it('isLWCJavascript()', async () => {
        const context = new LWCWorkspaceContext(SFDX_WORKSPACE_ROOT);
        await context.initialize();

        // lwc .js
        let document = await readAsTextDocument(join(FORCE_APP_ROOT, 'lwc', 'hello_world', 'hello_world.js'));
        expect(await context.isLWCJavascript(document)).toBeTruthy();

        // lwc .htm
        document = await readAsTextDocument(join(FORCE_APP_ROOT, 'lwc', 'hello_world', 'hello_world.html'));
        expect(await context.isLWCJavascript(document)).toBeFalsy();

        // aura cmps
        document = await readAsTextDocument(join(FORCE_APP_ROOT, 'aura', 'helloWorldApp', 'helloWorldApp.app'));
        expect(await context.isLWCJavascript(document)).toBeFalsy();

        // .js outside namespace roots
        document = await readAsTextDocument(join(FORCE_APP_ROOT, 'aura', 'todoApp', 'randomJsInAuraFolder.js'));
        expect(await context.isLWCJavascript(document)).toBeFalsy();

        // lwc .js in utils
        document = await readAsTextDocument(join(UTILS_ROOT, 'lwc', 'todo_util', 'todo_util.js'));
        expect(await context.isLWCJavascript(document)).toBeTruthy();
    });

    it('configureProjectForTs()', async () => {
        const context = new LWCWorkspaceContext(SFDX_WORKSPACE_ROOT);
        await context.initialize();
        const baseTsconfigPathForceApp = resolve(join(SFDX_WORKSPACE_ROOT, '.sfdx', 'tsconfig.sfdx.json'));
        const tsconfigPathForceApp = resolve(join(FORCE_APP_ROOT, 'lwc', 'tsconfig.json'));
        const tsconfigPathUtils = resolve(join(UTILS_ROOT, 'lwc', 'tsconfig.json'));
        const tsconfigPathRegisteredEmpty = resolve(join(REGISTERED_EMPTY_FOLDER_ROOT, 'lwc', 'tsconfig.json'));
        const forceignorePath = resolve(join(SFDX_WORKSPACE_ROOT, '.forceignore'));

        // configure and verify typings/jsconfig after configuration:
        await context.configureProjectForTs();

        // verify forceignore
        const forceignoreBuffer = await vscode.workspace.fs.readFile(vscode.Uri.file(forceignorePath));
        const forceignoreContent = Buffer.from(forceignoreBuffer).toString('utf8');
        expect(forceignoreContent).toContain('**/tsconfig.json');
        expect(forceignoreContent).toContain('**/*.ts');

        // verify tsconfig.sfdx.json
        const baseTsConfigBuffer = await vscode.workspace.fs.readFile(vscode.Uri.file(baseTsconfigPathForceApp));
        const baseTsConfigForceAppContent = JSON.parse(Buffer.from(baseTsConfigBuffer).toString('utf8'));
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
        const tsconfigBuffer = await vscode.workspace.fs.readFile(vscode.Uri.file(tsconfigPathForceApp));
        const tsconfigForceAppContent = JSON.parse(Buffer.from(tsconfigBuffer).toString('utf8'));
        expect(tsconfigForceAppContent).toEqual({
            extends: '../../../../.sfdx/tsconfig.sfdx.json',
            include: ['**/*.ts', '../../../../.sfdx/typings/lwc/**/*.d.ts'],
            exclude: ['**/__tests__/**'],
        });

        // clean up artifacts
        await vscode.workspace.fs.delete(vscode.Uri.file(baseTsconfigPathForceApp));
        await vscode.workspace.fs.delete(vscode.Uri.file(tsconfigPathForceApp));
        await vscode.workspace.fs.delete(vscode.Uri.file(tsconfigPathUtils));
        await vscode.workspace.fs.delete(vscode.Uri.file(tsconfigPathRegisteredEmpty));
        await vscode.workspace.fs.delete(vscode.Uri.file(forceignorePath));
    });
});
