/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { LWCWorkspaceContext } from '../context/lwc-context';
import { readAsTextDocument, FORCE_APP_ROOT, UTILS_ROOT, REGISTERED_EMPTY_FOLDER_ROOT } from './test-utils';

describe('LWCWorkspaceContext', () => {
    it('isLWCJavascript()', async () => {
        const context = new LWCWorkspaceContext('../../test-workspaces/sfdx-workspace');

        // lwc .js
        let document = readAsTextDocument(join(FORCE_APP_ROOT, 'lwc', 'hello_world', 'hello_world.js'));
        expect(await context.isLWCJavascript(document)).toBeTruthy();

        // lwc .htm
        document = readAsTextDocument(join(FORCE_APP_ROOT, 'lwc', 'hello_world', 'hello_world.html'));
        expect(await context.isLWCJavascript(document)).toBeFalsy();

        // aura cmps
        document = readAsTextDocument(join(FORCE_APP_ROOT, 'aura', 'helloWorldApp', 'helloWorldApp.app'));
        expect(await context.isLWCJavascript(document)).toBeFalsy();

        // .js outside namespace roots
        document = readAsTextDocument(join(FORCE_APP_ROOT, 'aura', 'todoApp', 'randomJsInAuraFolder.js'));
        expect(await context.isLWCJavascript(document)).toBeFalsy();

        // lwc .js in utils
        document = readAsTextDocument(join(UTILS_ROOT, 'lwc', 'todo_util', 'todo_util.js'));
        expect(await context.isLWCJavascript(document)).toBeTruthy();
    });

    it('configureProjectForTs()', async () => {
        const context = new LWCWorkspaceContext(resolve('../../test-workspaces/sfdx-workspace'));
        const baseTsconfigPathForceApp = resolve(join('../../test-workspaces', 'sfdx-workspace', '.sfdx', 'tsconfig.sfdx.json'));
        const tsconfigPathForceApp = resolve(join(FORCE_APP_ROOT, 'lwc', 'tsconfig.json'));
        const tsconfigPathUtils = resolve(join(UTILS_ROOT, 'lwc', 'tsconfig.json'));
        const tsconfigPathRegisteredEmpty = resolve(join(REGISTERED_EMPTY_FOLDER_ROOT, 'lwc', 'tsconfig.json'));
        const forceignorePath = resolve(join('../../test-workspaces', 'sfdx-workspace', '.forceignore'));

        // configure and verify typings/jsconfig after configuration:
        await context.configureProjectForTs();

        // verify forceignore
        const forceignoreContent = fs.readFileSync(forceignorePath, 'utf8');
        expect(forceignoreContent).toContain('**/tsconfig.json');
        expect(forceignoreContent).toContain('**/*.ts');

        // verify tsconfig.sfdx.json
        const baseTsConfigForceAppContent = JSON.parse(fs.readFileSync(baseTsconfigPathForceApp, 'utf8'));
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
        const tsconfigForceAppContent = JSON.parse(fs.readFileSync(tsconfigPathForceApp, 'utf8'));
        expect(tsconfigForceAppContent).toEqual({
            extends: '../../../../.sfdx/tsconfig.sfdx.json',
            include: ['**/*.ts', '../../../../.sfdx/typings/lwc/**/*.d.ts'],
            exclude: ['**/__tests__/**'],
        });

        // clean up artifacts
        fs.unlinkSync(baseTsconfigPathForceApp);
        fs.unlinkSync(tsconfigPathForceApp);
        fs.unlinkSync(tsconfigPathUtils);
        fs.unlinkSync(tsconfigPathRegisteredEmpty);
        fs.unlinkSync(forceignorePath);
    });
});
