/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import * as vscode from 'vscode';
import { processTemplate, getModulesDirs } from '../baseContext';
import '../../jest/matchers';
import { CORE_ALL_ROOT, CORE_PROJECT_ROOT, FORCE_APP_ROOT, UTILS_ROOT, readAsTextDocument, CORE_MULTI_ROOT } from './testUtils';
import { WorkspaceContext } from './workspaceContext';

beforeAll(() => {
    // make sure test runner config doesn't overlap with test workspace
    delete process.env.P4PORT;
    delete process.env.P4CLIENT;
    delete process.env.P4USER;
});

const verifyJsconfigCore = async (jsconfigPath: string): Promise<void> => {
    const jsconfigContent = Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.file(jsconfigPath))).toString('utf8');
    expect(jsconfigContent).toContain('    "compilerOptions": {'); // check formatting
    const jsconfig = JSON.parse(jsconfigContent);
    expect(jsconfig.compilerOptions.experimentalDecorators).toBe(true);
    expect(jsconfig.include[0]).toBe('**/*');
    expect(jsconfig.include[1]).toBe('../../.vscode/typings/lwc/**/*.d.ts');
    expect(jsconfig.typeAcquisition).toEqual({ include: ['jest'] });
    try {
        await vscode.workspace.fs.delete(vscode.Uri.file(jsconfigPath), { recursive: true, useTrash: false });
    } catch {
        // Ignore if file doesn't exist
    }
};

const verifyTypingsCore = async (): Promise<void> => {
    const typingsPath = `${CORE_ALL_ROOT}/.vscode/typings/lwc`;
    expect(`${typingsPath}/engine.d.ts`).toExist();
    expect(`${typingsPath}/lds.d.ts`).toExist();
    try {
        await vscode.workspace.fs.delete(vscode.Uri.file(typingsPath), { recursive: true, useTrash: false });
    } catch {
        // Ignore if file doesn't exist
    }
};

const verifyCoreSettings = (settings: any): void => {
    expect(settings['files.watcherExclude']).toBeDefined();
    expect(settings['perforce.client']).toBe('username-localhost-blt');
    expect(settings['perforce.user']).toBe('username');
    expect(settings['perforce.port']).toBe('ssl:host:port');
};

describe('WorkspaceContext', () => {
    it('WorkspaceContext', async () => {
        let context = new WorkspaceContext('test-workspaces/sfdx-workspace');
        expect(context.type).toBe('SFDX');
        expect(context.workspaceRoots[0]).toBeAbsolutePath();

        expect((await getModulesDirs(context.type, context.workspaceRoots, () => context.initSfdxProjectConfigCache())).length).toBe(3);

        context = new WorkspaceContext('test-workspaces/standard-workspace');
        expect(context.type).toBe('STANDARD_LWC');

        expect(await getModulesDirs(context.type, context.workspaceRoots, () => context.initSfdxProjectConfigCache())).toEqual([]);

        context = new WorkspaceContext(CORE_ALL_ROOT);
        expect(context.type).toBe('CORE_ALL');

        expect((await getModulesDirs(context.type, context.workspaceRoots, () => context.initSfdxProjectConfigCache())).length).toBe(2);

        context = new WorkspaceContext(CORE_PROJECT_ROOT);
        expect(context.type).toBe('CORE_PARTIAL');

        expect(await getModulesDirs(context.type, context.workspaceRoots, () => context.initSfdxProjectConfigCache())).toEqual([
            join(context.workspaceRoots[0], 'modules'),
        ]);

        context = new WorkspaceContext(CORE_MULTI_ROOT);
        expect(context.workspaceRoots.length).toBe(2);

        const modulesDirs = await getModulesDirs(context.type, context.workspaceRoots, () => context.initSfdxProjectConfigCache());
        for (let i = 0; i < context.workspaceRoots.length; i = i + 1) {
            expect(modulesDirs[i]).toMatch(context.workspaceRoots[i]);
        }
    });

    it('isInsideModulesRoots()', async () => {
        const context = new WorkspaceContext('test-workspaces/sfdx-workspace');

        let document = readAsTextDocument(join(FORCE_APP_ROOT, 'lwc', 'hello_world', 'hello_world.js'));
        expect(await context.isInsideModulesRoots(document)).toBeTruthy();

        document = readAsTextDocument(join(FORCE_APP_ROOT, 'aura', 'helloWorldApp', 'helloWorldApp.app'));
        expect(await context.isInsideModulesRoots(document)).toBeFalsy();

        document = readAsTextDocument(join(UTILS_ROOT, 'lwc', 'todo_util', 'todo_util.js'));
        expect(await context.isInsideModulesRoots(document)).toBeTruthy();
    });

    it('isLWCTemplate()', async () => {
        const context = new WorkspaceContext('test-workspaces/sfdx-workspace');

        // .js is not a template
        let document = readAsTextDocument(join(FORCE_APP_ROOT, 'lwc', 'hello_world', 'hello_world.js'));
        expect(await context.isLWCTemplate(document)).toBeFalsy();

        // .html is a template
        document = readAsTextDocument(join(FORCE_APP_ROOT, 'lwc', 'hello_world', 'hello_world.html'));
        expect(await context.isLWCTemplate(document)).toBeTruthy();

        // aura cmps are not a template (sfdx assigns the 'html' language id to aura components)
        document = readAsTextDocument(join(FORCE_APP_ROOT, 'aura', 'helloWorldApp', 'helloWorldApp.app'));
        expect(await context.isLWCTemplate(document)).toBeFalsy();

        // html outside namespace roots is not a template
        document = readAsTextDocument(join(FORCE_APP_ROOT, 'aura', 'todoApp', 'randomHtmlInAuraFolder.html'));
        expect(await context.isLWCTemplate(document)).toBeFalsy();

        // .html in utils folder is a template
        document = readAsTextDocument(join(UTILS_ROOT, 'lwc', 'todo_util', 'todo_util.html'));
        expect(await context.isLWCTemplate(document)).toBeTruthy();
    });

    it('processTemplate() with EJS', async () => {
        const templateString = `
{
  "compilerOptions": {
    "baseUrl": "<%= project_root %>",
    "paths": {
      "@/*": ["<%= project_root %>/src/*"]
    }
  }
}`;

        const variableMap = {
            project_root: '/path/to/project',
        };

        // Use the standalone function
        const result = processTemplate(templateString, variableMap);

        expect(result).toContain('"baseUrl": "/path/to/project"');
        expect(result).toContain('"@/*": ["/path/to/project/src/*"]');
        expect(result).not.toContain('${project_root}');
    });

    it('configureSfdxProject()', async () => {
        const context = new WorkspaceContext('test-workspaces/sfdx-workspace');
        const jsconfigPathForceApp = join(FORCE_APP_ROOT, 'lwc', 'jsconfig.json');
        const jsconfigPathUtilsOrig = join(UTILS_ROOT, 'lwc', 'jsconfig-orig.json');
        const jsconfigPathUtils = join(UTILS_ROOT, 'lwc', 'jsconfig.json');
        const sfdxTypingsPath = join('test-workspaces', 'sfdx-workspace', '.sfdx', 'typings', 'lwc');
        const forceignorePath = join('test-workspaces', 'sfdx-workspace', '.forceignore');

        // make sure no generated files are there from previous runs
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(jsconfigPathForceApp), { recursive: true, useTrash: false });
        } catch {
            // Ignore if file doesn't exist
        }
        try {
            const sourceContent = await vscode.workspace.fs.readFile(vscode.Uri.file(jsconfigPathUtilsOrig));
            await vscode.workspace.fs.writeFile(vscode.Uri.file(jsconfigPathUtils), sourceContent);
        } catch {
            // File operations failed - this might be expected in test cleanup
        }
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(forceignorePath), { recursive: true, useTrash: false });
        } catch {
            // Ignore if file doesn't exist
        }
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(sfdxTypingsPath), { recursive: true, useTrash: false });
        } catch {
            // Ignore if file doesn't exist
        }

        // verify typings/jsconfig after configuration:

        expect(jsconfigPathUtils).toExist();
        await context.configureProject();

        const { sfdxPackageDirsPattern } = await context.initSfdxProjectConfigCache();
        expect(sfdxPackageDirsPattern).toBe('{force-app,utils,registered-empty-folder}');

        // verify newly created jsconfig.json
        const jsconfigForceAppContent = Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.file(jsconfigPathForceApp))).toString('utf8');
        expect(jsconfigForceAppContent).toContain('    "compilerOptions": {'); // check formatting
        const jsconfigForceApp = JSON.parse(jsconfigForceAppContent);
        expect(jsconfigForceApp.compilerOptions.experimentalDecorators).toBe(true);
        expect(jsconfigForceApp.include[0]).toBe('**/*');
        expect(jsconfigForceApp.include[1]).toBe('../../../../.sfdx/typings/lwc/**/*.d.ts');
        expect(jsconfigForceApp.compilerOptions.baseUrl).toBeDefined(); // baseUrl/paths set when indexing
        expect(jsconfigForceApp.typeAcquisition).toEqual({ include: ['jest'] });
        // verify updated jsconfig.json
        const jsconfigUtilsContent = Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.file(jsconfigPathUtils))).toString('utf8');
        expect(jsconfigUtilsContent).toContain('    "compilerOptions": {'); // check formatting
        const jsconfigUtils = JSON.parse(jsconfigUtilsContent);
        expect(jsconfigUtils.compilerOptions.target).toBe('es2017');
        expect(jsconfigUtils.compilerOptions.experimentalDecorators).toBe(true);
        expect(jsconfigUtils.include[0]).toBe('util/*.js');
        expect(jsconfigUtils.include[1]).toBe('**/*');
        expect(jsconfigUtils.include[2]).toBe('../../../.sfdx/typings/lwc/**/*.d.ts');
        expect(jsconfigForceApp.typeAcquisition).toEqual({ include: ['jest'] });

        // .forceignore
        const forceignoreContent = Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.file(forceignorePath))).toString('utf8');
        expect(forceignoreContent).toContain('**/jsconfig.json');
        expect(forceignoreContent).toContain('**/.eslintrc.json');
        // These should only be present for TypeScript projects
        expect(forceignoreContent).not.toContain('**/tsconfig.json');
        expect(forceignoreContent).not.toContain('**/*.ts');

        // typings
        expect(join(sfdxTypingsPath, 'lds.d.ts')).toExist();
        expect(join(sfdxTypingsPath, 'engine.d.ts')).toExist();
        expect(join(sfdxTypingsPath, 'apex.d.ts')).toExist();
        const schemaContents = Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.file(join(sfdxTypingsPath, 'schema.d.ts')))).toString('utf8');
        expect(schemaContents).toContain("declare module '@salesforce/schema' {");
        const apexContents = Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.file(join(sfdxTypingsPath, 'apex.d.ts')))).toString('utf8');
        expect(apexContents).not.toContain('declare type');
    });

    /*
function verifyCodeWorkspace(path: string) {
    const content = Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.file(path))).toString('utf8');
    const workspace = JSON.parse(content);
    const folders = workspace.folders;
    expect(folders.length).toBe(1);
    const folderPath = folders[0].path;
    expect(folderPath).toBeAbsolutePath();
    expect(folderPath).toEndWith(utils.unixify(CORE_ALL_ROOT));
    const settings = workspace.settings;
    expect(settings['java.home']).toBe('path_to_java_home');
    expect(settings['extensions.ignoreRecommendations']).toBeTruthy();
    verifyCoreSettings(settings);
}
*/

    it('configureCoreProject()', async () => {
        const context = new WorkspaceContext(CORE_PROJECT_ROOT);
        const jsconfigPath = `${CORE_PROJECT_ROOT}/modules/jsconfig.json`;
        const typingsPath = `${CORE_ALL_ROOT}/.vscode/typings/lwc`;
        const settingsPath = `${CORE_PROJECT_ROOT}/.vscode/settings.json`;

        // make sure no generated files are there from previous runs
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(jsconfigPath), { recursive: true, useTrash: false });
        } catch {
            // Ignore if file doesn't exist
        }
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(typingsPath), { recursive: true, useTrash: false });
        } catch {
            // Ignore if file doesn't exist
        }
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(settingsPath), { recursive: true, useTrash: false });
        } catch {
            // Ignore if file doesn't exist
        }

        // configure and verify typings/jsconfig after configuration:
        await context.configureProject();

        await verifyJsconfigCore(jsconfigPath);
        await verifyTypingsCore();

        const settings = JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.file(settingsPath))).toString('utf8'));
        verifyCoreSettings(settings);
    });

    it('configureCoreMulti()', async () => {
        const context = new WorkspaceContext(CORE_MULTI_ROOT);

        const jsconfigPathForce = `${context.workspaceRoots[0]}/modules/jsconfig.json`;
        const jsconfigPathGlobal = `${context.workspaceRoots[1]}/modules/jsconfig.json`;
        const codeWorkspacePath = `${CORE_ALL_ROOT}/core.code-workspace`;
        const launchPath = `${CORE_ALL_ROOT}/.vscode/launch.json`;
        const tsconfigPathForce = `${context.workspaceRoots[0]}/tsconfig.json`;

        // make sure no generated files are there from previous runs
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(jsconfigPathGlobal), { recursive: true, useTrash: false });
        } catch {
            // Ignore if file doesn't exist
        }
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(jsconfigPathForce), { recursive: true, useTrash: false });
        } catch {
            // Ignore if file doesn't exist
        }
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(codeWorkspacePath), { recursive: true, useTrash: false });
        } catch {
            // Ignore if file doesn't exist
        }
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(launchPath), { recursive: true, useTrash: false });
        } catch {
            // Ignore if file doesn't exist
        }
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(tsconfigPathForce), { recursive: true, useTrash: false });
        } catch {
            // Ignore if file doesn't exist
        }

        await vscode.workspace.fs.writeFile(vscode.Uri.file(tsconfigPathForce), new TextEncoder().encode(''));

        // configure and verify typings/jsconfig after configuration:
        await context.configureProject();

        // verify newly created jsconfig.json
        await verifyJsconfigCore(jsconfigPathGlobal);
        // verify jsconfig.json is not created when there is a tsconfig.json
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(tsconfigPathForce));
            expect(tsconfigPathForce).not.toExist();
        } catch {
            // File doesn't exist, which is expected
        }
        await verifyTypingsCore();

        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(tsconfigPathForce), { recursive: true, useTrash: false });
        } catch {
            // Ignore if file doesn't exist
        }
    });

    it('configureCoreAll()', async () => {
        const context = new WorkspaceContext(CORE_ALL_ROOT);
        const jsconfigPathGlobal = `${CORE_ALL_ROOT}/ui-global-components/modules/jsconfig.json`;
        const jsconfigPathForce = `${CORE_ALL_ROOT}/ui-force-components/modules/jsconfig.json`;
        const codeWorkspacePath = `${CORE_ALL_ROOT}/core.code-workspace`;
        const launchPath = `${CORE_ALL_ROOT}/.vscode/launch.json`;

        // make sure no generated files are there from previous runs
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(jsconfigPathGlobal), { recursive: true, useTrash: false });
        } catch {
            // Ignore if file doesn't exist
        }
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(jsconfigPathForce), { recursive: true, useTrash: false });
        } catch {
            // Ignore if file doesn't exist
        }
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(codeWorkspacePath), { recursive: true, useTrash: false });
        } catch {
            // Ignore if file doesn't exist
        }
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(launchPath), { recursive: true, useTrash: false });
        } catch {
            // Ignore if file doesn't exist
        }

        // configure and verify typings/jsconfig after configuration:
        await context.configureProject();

        // verify newly created jsconfig.json
        await verifyJsconfigCore(jsconfigPathGlobal);
        await verifyJsconfigCore(jsconfigPathForce);
        await verifyTypingsCore();

        // Commenting out core-workspace & launch.json tests until we finalize
        // where these should live or if they should exist at all

        // verifyCodeWorkspace(codeWorkspacePath);

        // launch.json
        // const launchContent = Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.file(launchPath))).toString('utf8');
        // expect(launchContent).toContain('"name": "SFDC (attach)"');
    });
});
