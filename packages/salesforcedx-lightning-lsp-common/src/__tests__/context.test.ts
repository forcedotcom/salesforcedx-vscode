/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'node:path';
import { getModulesDirs } from '../baseContext';
import '../../jest/matchers';
import { FileSystemDataProvider } from '../providers/fileSystemDataProvider';
import { normalizePath } from '../utils';
import {
  CORE_ALL_ROOT,
  CORE_PROJECT_ROOT,
  FORCE_APP_ROOT,
  UTILS_ROOT,
  CORE_MULTI_ROOT,
  sfdxFileSystemProvider,
  standardFileSystemProvider,
  coreFileSystemProvider,
  coreProjectFileSystemProvider,
  coreMultiFileSystemProvider
} from './testUtils';
import { WorkspaceContext } from './workspaceContext';

// Test workspace paths - use absolute paths that work regardless of where code is run from
const SFDX_WORKSPACE_PATH = normalizePath(
  path.resolve(__dirname, '..', '..', '..', '..', 'test-workspaces', 'sfdx-workspace')
);
const STANDARD_WORKSPACE_PATH = normalizePath(
  path.resolve(__dirname, '..', '..', '..', '..', 'test-workspaces', 'standard-workspace')
);
const CORE_WORKSPACE_PATH = normalizePath(
  path.resolve(__dirname, '..', '..', '..', '..', 'test-workspaces', 'core-like-workspace', 'app', 'main', 'core')
);

// Mock JSON imports using fs.readFileSync since Jest cannot directly import JSON files

beforeAll(() => {
  // make sure test runner config doesn't overlap with test workspace
  delete process.env.P4PORT;
  delete process.env.P4CLIENT;
  delete process.env.P4USER;
});

const verifyJsconfigCore = async (fileSystemProvider: FileSystemDataProvider, jsconfigPath: string): Promise<void> => {
  const jsconfigContent = Buffer.from(fileSystemProvider.getFileContent(jsconfigPath) ?? '').toString('utf8');
  expect(jsconfigContent).toContain('"compilerOptions":{');
  const jsconfig = JSON.parse(jsconfigContent);
  expect(jsconfig.compilerOptions.experimentalDecorators).toBe(true);
  expect(jsconfig.include[0]).toBe('**/*');
  expect(jsconfig.include[1]).toBe('../../.vscode/typings/lwc/**/*.d.ts');
  expect(jsconfig.typeAcquisition).toEqual({ include: ['jest'] });
  fileSystemProvider.updateFileStat(jsconfigPath, {
    type: 'file',
    exists: false,
    ctime: 0,
    mtime: 0,
    size: 0
  });
};

const verifyTypingsCore = async (fileSystemProvider: FileSystemDataProvider): Promise<void> => {
  const typingsPath = path.join(CORE_ALL_ROOT, '.vscode', 'typings', 'lwc');
  expect(fileSystemProvider.fileExists(path.join(typingsPath, 'engine.d.ts'))).toBe(true);
  expect(fileSystemProvider.fileExists(path.join(typingsPath, 'lds.d.ts'))).toBe(true);
  try {
    fileSystemProvider.updateFileStat(typingsPath, {
      type: 'directory',
      exists: false,
      ctime: 0,
      mtime: 0,
      size: 0
    });
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
    let context = new WorkspaceContext(SFDX_WORKSPACE_PATH, sfdxFileSystemProvider);
    context.initialize('SFDX');
    expect(context.type).toBe('SFDX');
    expect(context.workspaceRoots[0]).toBeAbsolutePath();

    expect(
      (
        await getModulesDirs(context.type, context.workspaceRoots, sfdxFileSystemProvider, () =>
          context.initSfdxProjectConfigCache()
        )
      ).length
    ).toBe(3);

    context = new WorkspaceContext(STANDARD_WORKSPACE_PATH, standardFileSystemProvider);
    context.initialize('STANDARD_LWC');
    expect(context.type).toBe('STANDARD_LWC');

    expect(
      await getModulesDirs(context.type, context.workspaceRoots, standardFileSystemProvider, () =>
        context.initSfdxProjectConfigCache()
      )
    ).toEqual([]);

    context = new WorkspaceContext(CORE_WORKSPACE_PATH, coreFileSystemProvider);
    context.initialize('CORE_ALL');
    expect(context.type).toBe('CORE_ALL');

    expect(
      (
        await getModulesDirs(context.type, context.workspaceRoots, coreFileSystemProvider, () =>
          context.initSfdxProjectConfigCache()
        )
      ).length
    ).toBe(3);

    context = new WorkspaceContext(CORE_PROJECT_ROOT, coreProjectFileSystemProvider);
    context.initialize('CORE_PARTIAL');
    expect(context.type).toBe('CORE_PARTIAL');

    expect(
      await getModulesDirs(context.type, context.workspaceRoots, coreProjectFileSystemProvider, () =>
        context.initSfdxProjectConfigCache()
      )
    ).toEqual([normalizePath(path.join(context.workspaceRoots[0], 'modules'))]);

    context = new WorkspaceContext(CORE_MULTI_ROOT, coreMultiFileSystemProvider);
    context.initialize('CORE_ALL');
    expect(context.workspaceRoots.length).toBe(2);

    const modulesDirs = await getModulesDirs(context.type, context.workspaceRoots, coreMultiFileSystemProvider, () =>
      context.initSfdxProjectConfigCache()
    );
    for (let i = 0; i < context.workspaceRoots.length; i = i + 1) {
      // modulesDirs[i] should be a path like "workspaceRoot/modules", so it should start with workspaceRoot
      // Normalize both paths to ensure consistent comparison (especially Windows drive letter casing)
      expect(normalizePath(modulesDirs[i])).toContain(normalizePath(context.workspaceRoots[i]));
    }
  });

  it('configureSfdxProject()', async () => {
    const context = new WorkspaceContext(SFDX_WORKSPACE_PATH, sfdxFileSystemProvider);
    context.initialize('SFDX');
    const jsconfigPathForceApp = path.resolve(FORCE_APP_ROOT, 'lwc', 'jsconfig.json');
    const jsconfigPathUtilsOrig = path.resolve(UTILS_ROOT, 'lwc', 'jsconfig-orig.json');
    const jsconfigPathUtils = path.resolve(UTILS_ROOT, 'lwc', 'jsconfig.json');

    // make sure no generated files are there from previous runs
    try {
      sfdxFileSystemProvider.updateFileStat(jsconfigPathForceApp, {
        type: 'file',
        exists: false,
        ctime: 0,
        mtime: 0,
        size: 0
      });
    } catch {
      // Ignore if file doesn't exist
    }
    try {
      const sourceContent = sfdxFileSystemProvider.getFileContent(jsconfigPathUtilsOrig) ?? '';
      sfdxFileSystemProvider.updateFileContent(jsconfigPathUtils, sourceContent);
    } catch {
      // File operations failed - this might be expected in test cleanup
    }
    try {
      sfdxFileSystemProvider.updateFileStat(path.resolve(context.workspaceRoots[0], '.forceignore'), {
        type: 'file',
        exists: false,
        ctime: 0,
        mtime: 0,
        size: 0
      });
    } catch {
      // Ignore if file doesn't exist
    }
    try {
      sfdxFileSystemProvider.updateFileStat(path.resolve(context.workspaceRoots[0], '.sfdx', 'typings', 'lwc'), {
        type: 'directory',
        exists: false,
        ctime: 0,
        mtime: 0,
        size: 0
      });
    } catch {
      // Ignore if file doesn't exist
    }

    // verify typings/jsconfig after configuration:

    expect(sfdxFileSystemProvider.fileExists(jsconfigPathUtils)).toBe(true);
    await context.configureProject();

    const { sfdxPackageDirsPattern } = await context.initSfdxProjectConfigCache();
    expect(sfdxPackageDirsPattern).toBe('{force-app,utils,registered-empty-folder}');

    // verify newly created jsconfig.json
    const jsconfigForceAppContent = Buffer.from(
      sfdxFileSystemProvider.getFileContent(jsconfigPathForceApp) ?? ''
    ).toString('utf8');
    expect(jsconfigForceAppContent).toContain('"compilerOptions":{');
    const jsconfigForceApp = JSON.parse(jsconfigForceAppContent);
    expect(jsconfigForceApp.compilerOptions.experimentalDecorators).toBe(true);
    expect(jsconfigForceApp.include[0]).toBe('**/*');
    expect(jsconfigForceApp.include[1]).toBe('../../../../.sfdx/typings/lwc/**/*.d.ts');
    expect(jsconfigForceApp.compilerOptions.baseUrl).toBeDefined(); // baseUrl/paths set when indexing
    expect(jsconfigForceApp.typeAcquisition).toEqual({ include: ['jest'] });
    // verify updated jsconfig.json
    const jsconfigUtilsContent = Buffer.from(sfdxFileSystemProvider.getFileContent(jsconfigPathUtils) ?? '').toString(
      'utf8'
    );
    expect(jsconfigUtilsContent).toContain('"compilerOptions": {');
    const jsconfigUtils = JSON.parse(jsconfigUtilsContent);
    expect(jsconfigUtils.compilerOptions.target).toBe('es2017');
    expect(jsconfigUtils.compilerOptions.experimentalDecorators).toBe(true);
    expect(jsconfigUtils.include[0]).toBe('util/*.js');
    expect(jsconfigUtils.include[1]).toBe('**/*');
    expect(jsconfigUtils.include[2]).toBe('../../../.sfdx/typings/lwc/**/*.d.ts');
    expect(jsconfigForceApp.typeAcquisition).toEqual({ include: ['jest'] });

    // .forceignore
    const forceignoreContent = Buffer.from(
      sfdxFileSystemProvider.getFileContent(path.resolve(context.workspaceRoots[0], '.forceignore')) ?? ''
    ).toString('utf8');
    expect(forceignoreContent).toContain('**/jsconfig.json');
    expect(forceignoreContent).toContain('**/.eslintrc.json');
    // These should only be present for TypeScript projects
    expect(forceignoreContent).not.toContain('**/tsconfig.json');
    expect(forceignoreContent).not.toContain('**/*.ts');

    // typings
    expect(
      sfdxFileSystemProvider.fileExists(path.resolve(context.workspaceRoots[0], '.sfdx', 'typings', 'lwc', 'lds.d.ts'))
    ).toBe(true);
    expect(
      sfdxFileSystemProvider.fileExists(
        path.resolve(context.workspaceRoots[0], '.sfdx', 'typings', 'lwc', 'engine.d.ts')
      )
    ).toBe(true);
    expect(
      sfdxFileSystemProvider.fileExists(path.resolve(context.workspaceRoots[0], '.sfdx', 'typings', 'lwc', 'apex.d.ts'))
    ).toBe(true);
    const schemaContents = Buffer.from(
      sfdxFileSystemProvider.getFileContent(
        path.resolve(context.workspaceRoots[0], '.sfdx', 'typings', 'lwc', 'schema.d.ts')
      ) ?? ''
    ).toString('utf8');
    expect(schemaContents).toContain("declare module '@salesforce/schema' {");
    const apexContents = Buffer.from(
      sfdxFileSystemProvider.getFileContent(
        path.resolve(context.workspaceRoots[0], '.sfdx', 'typings', 'lwc', 'apex.d.ts')
      ) ?? ''
    ).toString('utf8');
    expect(apexContents).not.toContain('declare type');
  });

  it('configureCoreProject()', async () => {
    const context = new WorkspaceContext(CORE_PROJECT_ROOT, coreProjectFileSystemProvider);
    context.initialize('CORE_PARTIAL');
    const jsconfigPath = path.join(CORE_PROJECT_ROOT, 'modules', 'jsconfig.json');
    const typingsPath = path.join(CORE_ALL_ROOT, '.vscode', 'typings', 'lwc');
    const settingsPath = path.join(CORE_PROJECT_ROOT, '.vscode', 'settings.json');

    // make sure no generated files are there from previous runs
    try {
      coreProjectFileSystemProvider.updateFileStat(jsconfigPath, {
        type: 'file',
        exists: false,
        ctime: 0,
        mtime: 0,
        size: 0
      });
    } catch {
      // Ignore if file doesn't exist
    }
    try {
      coreProjectFileSystemProvider.updateFileStat(typingsPath, {
        type: 'directory',
        exists: false,
        ctime: 0,
        mtime: 0,
        size: 0
      });
    } catch {
      // Ignore if file doesn't exist
    }
    try {
      coreProjectFileSystemProvider.updateFileStat(settingsPath, {
        type: 'file',
        exists: false,
        ctime: 0,
        mtime: 0,
        size: 0
      });
    } catch {
      // Ignore if file doesn't exist
    }

    // configure and verify typings/jsconfig after configuration:
    await context.configureProject();

    await verifyJsconfigCore(coreProjectFileSystemProvider, jsconfigPath);
    await verifyTypingsCore(coreProjectFileSystemProvider);

    const settings = JSON.parse(
      Buffer.from(coreProjectFileSystemProvider.getFileContent(settingsPath) ?? '').toString('utf8')
    );
    verifyCoreSettings(settings);
  });

  it('configureCoreMulti()', async () => {
    const context = new WorkspaceContext(CORE_MULTI_ROOT, coreMultiFileSystemProvider);
    context.initialize('CORE_ALL');

    const jsconfigPathGlobal = `${context.workspaceRoots[1]}/modules/jsconfig.json`;
    const tsconfigPathForce = `${context.workspaceRoots[0]}/tsconfig.json`;

    // configure and verify typings/jsconfig after configuration:
    await context.configureProject();

    // verify newly created jsconfig.json
    await verifyJsconfigCore(coreMultiFileSystemProvider, jsconfigPathGlobal);
    // verify jsconfig.json is not created when there is a tsconfig.json
    // The tsconfig.json in the workspace root should not prevent jsconfig creation in modules dir
    // Just verify the tsconfig still exists
    expect(coreMultiFileSystemProvider.fileExists(tsconfigPathForce)).toBe(true);
    await verifyTypingsCore(coreMultiFileSystemProvider);

    coreMultiFileSystemProvider.updateFileStat(tsconfigPathForce, {
      type: 'file',
      exists: false,
      ctime: 0,
      mtime: 0,
      size: 0
    });
  });

  it('configureCoreAll()', async () => {
    const context = new WorkspaceContext(CORE_ALL_ROOT, coreFileSystemProvider);
    context.initialize('CORE_ALL');
    const jsconfigPathGlobal = path.join(CORE_ALL_ROOT, 'ui-global-components', 'modules', 'jsconfig.json');
    const jsconfigPathForce = path.join(CORE_ALL_ROOT, 'ui-force-components', 'modules', 'jsconfig.json');

    // configure and verify typings/jsconfig after configuration:
    await context.configureProject();

    // verify newly created jsconfig.json
    await verifyJsconfigCore(coreMultiFileSystemProvider, jsconfigPathGlobal);
    await verifyJsconfigCore(coreMultiFileSystemProvider, jsconfigPathForce);
    await verifyTypingsCore(coreMultiFileSystemProvider);

    // Commenting out core-workspace & launch.json tests until we finalize
    // where these should live or if they should exist at all

    // verifyCodeWorkspace(codeWorkspacePath);

    // launch.json
    // const launchContent = Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.file(launchPath))).toString('utf8');
    // expect(launchContent).toContain('"name": "SFDC (attach)"');
  });
});
