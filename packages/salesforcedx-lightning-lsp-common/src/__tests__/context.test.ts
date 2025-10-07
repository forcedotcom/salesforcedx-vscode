/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import * as vscode from 'vscode';
import { WorkspaceContext } from './workspaceContext';
import { processTemplate, getModulesDirs } from '../baseContext';
import '../../jest/matchers';
import { CORE_ALL_ROOT, CORE_PROJECT_ROOT, FORCE_APP_ROOT, UTILS_ROOT, readAsTextDocument, CORE_MULTI_ROOT } from './testUtils';

beforeAll(() => {
    // make sure test runner config doesn't overlap with test workspace
    delete process.env.P4PORT;
    delete process.env.P4CLIENT;
    delete process.env.P4USER;
});

describe('WorkspaceContext', () => {
    it('WorkspaceContext', async () => {
        let context = new WorkspaceContext('test-workspaces/sfdx-workspace');
        expect(context.type).toBe('SFDX');
        expect(context.workspaceRoots[0]).toBeAbsolutePath();

        expect((await getModulesDirs(context.type, context.workspaceRoots, (context as any).initSfdxProjectConfigCache.bind(context))).length).toBe(3);

        context = new WorkspaceContext('test-workspaces/standard-workspace');
        expect(context.type).toBe('STANDARD_LWC');

        expect(await getModulesDirs(context.type, context.workspaceRoots, (context as any).initSfdxProjectConfigCache.bind(context))).toEqual([]);

        context = new WorkspaceContext(CORE_ALL_ROOT);
        expect(context.type).toBe('CORE_ALL');

        expect((await getModulesDirs(context.type, context.workspaceRoots, (context as any).initSfdxProjectConfigCache.bind(context))).length).toBe(2);

        context = new WorkspaceContext(CORE_PROJECT_ROOT);
        expect(context.type).toBe('CORE_PARTIAL');

        expect(await getModulesDirs(context.type, context.workspaceRoots, (context as any).initSfdxProjectConfigCache.bind(context))).toEqual([
            join(context.workspaceRoots[0], 'modules'),
        ]);

        context = new WorkspaceContext(CORE_MULTI_ROOT);
        expect(context.workspaceRoots.length).toBe(2);

        const modulesDirs = await getModulesDirs(context.type, context.workspaceRoots, (context as any).initSfdxProjectConfigCache.bind(context));
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
        fs.rmSync(jsconfigPathForceApp, { recursive: true, force: true });
        fs.copyFileSync(jsconfigPathUtilsOrig, jsconfigPathUtils);
        fs.rmSync(forceignorePath, { recursive: true, force: true });
        fs.rmSync(sfdxTypingsPath, { recursive: true, force: true });

        // verify typings/jsconfig after configuration:

        expect(jsconfigPathUtils).toExist();
        await context.configureProject();

        const { sfdxPackageDirsPattern } = await context.initSfdxProjectConfigCache();
        expect(sfdxPackageDirsPattern).toBe('{force-app,utils,registered-empty-folder}');

        // verify newly created jsconfig.json
        const jsconfigForceAppContent = fs.readFileSync(jsconfigPathForceApp, 'utf8');
        expect(jsconfigForceAppContent).toContain('    "compilerOptions": {'); // check formatting
        const jsconfigForceApp = JSON.parse(jsconfigForceAppContent);
        expect(jsconfigForceApp.compilerOptions.experimentalDecorators).toBe(true);
        expect(jsconfigForceApp.include[0]).toBe('**/*');
        expect(jsconfigForceApp.include[1]).toBe('../../../../.sfdx/typings/lwc/**/*.d.ts');
        expect(jsconfigForceApp.compilerOptions.baseUrl).toBeDefined(); // baseUrl/paths set when indexing
        expect(jsconfigForceApp.typeAcquisition).toEqual({ include: ['jest'] });
        // verify updated jsconfig.json
        const jsconfigUtilsContent = fs.readFileSync(jsconfigPathUtils, 'utf8');
        expect(jsconfigUtilsContent).toContain('    "compilerOptions": {'); // check formatting
        const jsconfigUtils = JSON.parse(jsconfigUtilsContent);
        expect(jsconfigUtils.compilerOptions.target).toBe('es2017');
        expect(jsconfigUtils.compilerOptions.experimentalDecorators).toBe(true);
        expect(jsconfigUtils.include[0]).toBe('util/*.js');
        expect(jsconfigUtils.include[1]).toBe('**/*');
        expect(jsconfigUtils.include[2]).toBe('../../../.sfdx/typings/lwc/**/*.d.ts');
        expect(jsconfigForceApp.typeAcquisition).toEqual({ include: ['jest'] });

        // .forceignore
        const forceignoreContent = fs.readFileSync(forceignorePath, 'utf8');
        expect(forceignoreContent).toContain('**/jsconfig.json');
        expect(forceignoreContent).toContain('**/.eslintrc.json');
        // These should only be present for TypeScript projects
        expect(forceignoreContent).not.toContain('**/tsconfig.json');
        expect(forceignoreContent).not.toContain('**/*.ts');

        // typings
        expect(join(sfdxTypingsPath, 'lds.d.ts')).toExist();
        expect(join(sfdxTypingsPath, 'engine.d.ts')).toExist();
        expect(join(sfdxTypingsPath, 'apex.d.ts')).toExist();
        const schemaContents = fs.readFileSync(join(sfdxTypingsPath, 'schema.d.ts'), 'utf8');
        expect(schemaContents).toContain("declare module '@salesforce/schema' {");
        const apexContents = fs.readFileSync(join(sfdxTypingsPath, 'apex.d.ts'), 'utf8');
        expect(apexContents).not.toContain('declare type');
    });

    const verifyJsconfigCore = (jsconfigPath: string): void => {
        const jsconfigContent = fs.readFileSync(jsconfigPath, 'utf8');
        expect(jsconfigContent).toContain('    "compilerOptions": {'); // check formatting
        const jsconfig = JSON.parse(jsconfigContent);
        expect(jsconfig.compilerOptions.experimentalDecorators).toBe(true);
        expect(jsconfig.include[0]).toBe('**/*');
        expect(jsconfig.include[1]).toBe('../../.vscode/typings/lwc/**/*.d.ts');
        expect(jsconfig.typeAcquisition).toEqual({ include: ['jest'] });
        fs.rmSync(jsconfigPath, { recursive: true, force: true });
    };

    const verifyTypingsCore = (): void => {
        const typingsPath = `${CORE_ALL_ROOT}/.vscode/typings/lwc`;
        expect(`${typingsPath}/engine.d.ts`).toExist();
        expect(`${typingsPath}/lds.d.ts`).toExist();
        fs.rmSync(typingsPath, { recursive: true, force: true });
    };

    const verifyCoreSettings = (settings: any): void => {
        expect(settings['files.watcherExclude']).toBeDefined();
        expect(settings['perforce.client']).toBe('username-localhost-blt');
        expect(settings['perforce.user']).toBe('username');
        expect(settings['perforce.port']).toBe('ssl:host:port');
    };

    /*
function verifyCodeWorkspace(path: string) {
    const content = fs.readFileSync(path, 'utf8');
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
        fs.rmSync(jsconfigPath, { recursive: true, force: true });
        fs.rmSync(typingsPath, { recursive: true, force: true });
        fs.rmSync(settingsPath, { recursive: true, force: true });

        // configure and verify typings/jsconfig after configuration:
        await context.configureProject();

        verifyJsconfigCore(jsconfigPath);
        verifyTypingsCore();

        const settings = JSON.parse(await fs.promises.readFile(settingsPath, 'utf8'));
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
        fs.rmSync(jsconfigPathGlobal, { recursive: true, force: true });
        fs.rmSync(jsconfigPathForce, { recursive: true, force: true });
        fs.rmSync(codeWorkspacePath, { recursive: true, force: true });
        fs.rmSync(launchPath, { recursive: true, force: true });
        fs.rmSync(tsconfigPathForce, { recursive: true, force: true });

        fs.writeFileSync(tsconfigPathForce, '');

        // configure and verify typings/jsconfig after configuration:
        await context.configureProject();

        // verify newly created jsconfig.json
        verifyJsconfigCore(jsconfigPathGlobal);
        // verify jsconfig.json is not created when there is a tsconfig.json
        expect(fs.existsSync(tsconfigPathForce)).not.toExist();
        verifyTypingsCore();

        fs.rmSync(tsconfigPathForce, { recursive: true, force: true });
    });

    it('configureCoreAll()', async () => {
        const context = new WorkspaceContext(CORE_ALL_ROOT);
        const jsconfigPathGlobal = `${CORE_ALL_ROOT}/ui-global-components/modules/jsconfig.json`;
        const jsconfigPathForce = `${CORE_ALL_ROOT}/ui-force-components/modules/jsconfig.json`;
        const codeWorkspacePath = `${CORE_ALL_ROOT}/core.code-workspace`;
        const launchPath = `${CORE_ALL_ROOT}/.vscode/launch.json`;

        // make sure no generated files are there from previous runs
        fs.rmSync(jsconfigPathGlobal, { recursive: true, force: true });
        fs.rmSync(jsconfigPathForce, { recursive: true, force: true });
        fs.rmSync(codeWorkspacePath, { recursive: true, force: true });
        fs.rmSync(launchPath, { recursive: true, force: true });

        // configure and verify typings/jsconfig after configuration:
        await context.configureProject();

        // verify newly created jsconfig.json
        verifyJsconfigCore(jsconfigPathGlobal);
        verifyJsconfigCore(jsconfigPathForce);
        verifyTypingsCore();

        // Commenting out core-workspace & launch.json tests until we finalize
        // where these should live or if they should exist at all

        // verifyCodeWorkspace(codeWorkspacePath);

        // launch.json
        // const launchContent = fs.readFileSync(launchPath, 'utf8');
        // expect(launchContent).toContain('"name": "SFDC (attach)"');
    });
});
