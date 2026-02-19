/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { WORKSPACE_FIND_FILES_REQUEST } from '@salesforce/salesforcedx-lightning-lsp-common';
import {
  readAsTextDocument,
  FORCE_APP_ROOT,
  UTILS_ROOT,
  REGISTERED_EMPTY_FOLDER_ROOT,
  SFDX_WORKSPACE_ROOT,
  sfdxFileSystemProvider
} from '@salesforce/salesforcedx-lightning-lsp-common/testUtils';
import { join, resolve } from 'node:path';
import { URI } from 'vscode-uri';
import { LWCWorkspaceContext } from '../context/lwcContext';
import { createMockWorkspaceFindFilesConnection } from './mockWorkspaceFindFiles';

// Discovery via workspace/findFiles so context can find LWC/aura roots (no server-side cache)
sfdxFileSystemProvider.setWorkspaceFolderUris([URI.file(SFDX_WORKSPACE_ROOT).toString()]);
sfdxFileSystemProvider.setFindFilesFromConnection(
  createMockWorkspaceFindFilesConnection(SFDX_WORKSPACE_ROOT) as Parameters<
    typeof sfdxFileSystemProvider.setFindFilesFromConnection
  >[0],
  WORKSPACE_FIND_FILES_REQUEST
);

describe('LWCWorkspaceContext', () => {
  it('isLWCJavascript()', async () => {
    const context = new LWCWorkspaceContext([SFDX_WORKSPACE_ROOT], sfdxFileSystemProvider);
    context.initialize('SFDX');

    // lwc .js
    let document = await readAsTextDocument(
      join(FORCE_APP_ROOT, 'lwc', 'hello_world', 'hello_world.js'),
      sfdxFileSystemProvider
    );
    expect(await context.isLWCJavascript(document)).toBeTruthy();

    // lwc .htm
    document = await readAsTextDocument(
      join(FORCE_APP_ROOT, 'lwc', 'hello_world', 'hello_world.html'),
      sfdxFileSystemProvider
    );
    expect(await context.isLWCJavascript(document)).toBeFalsy();

    // aura cmps
    document = await readAsTextDocument(
      join(FORCE_APP_ROOT, 'aura', 'helloWorldApp', 'helloWorldApp.app'),
      sfdxFileSystemProvider
    );
    expect(await context.isLWCJavascript(document)).toBeFalsy();

    // .js outside namespace roots
    document = await readAsTextDocument(
      join(FORCE_APP_ROOT, 'aura', 'todoApp', 'randomJsInAuraFolder.js'),
      sfdxFileSystemProvider
    );
    expect(await context.isLWCJavascript(document)).toBeFalsy();

    // lwc .js in utils
    document = await readAsTextDocument(join(UTILS_ROOT, 'lwc', 'todo_util', 'todo_util.js'), sfdxFileSystemProvider);
    expect(await context.isLWCJavascript(document)).toBeTruthy();
  });

  it('isInsideModulesRoots()', async () => {
    const context = new LWCWorkspaceContext([SFDX_WORKSPACE_ROOT], sfdxFileSystemProvider);
    context.initialize('SFDX');

    let document = await readAsTextDocument(
      join(FORCE_APP_ROOT, 'lwc', 'hello_world', 'hello_world.js'),
      sfdxFileSystemProvider
    );
    expect(await context.isInsideModulesRoots(document)).toBeTruthy();

    document = await readAsTextDocument(
      join(FORCE_APP_ROOT, 'aura', 'helloWorldApp', 'helloWorldApp.app'),
      sfdxFileSystemProvider
    );
    expect(await context.isInsideModulesRoots(document)).toBeFalsy();

    document = await readAsTextDocument(join(UTILS_ROOT, 'lwc', 'todo_util', 'todo_util.js'), sfdxFileSystemProvider);
    expect(await context.isInsideModulesRoots(document)).toBeTruthy();
  });

  it('isLWCTemplate()', async () => {
    const context = new LWCWorkspaceContext([SFDX_WORKSPACE_ROOT], sfdxFileSystemProvider);
    context.initialize('SFDX');

    // .js is not a template
    let document = await readAsTextDocument(
      join(FORCE_APP_ROOT, 'lwc', 'hello_world', 'hello_world.js'),
      sfdxFileSystemProvider
    );
    expect(await context.isLWCTemplate(document)).toBeFalsy();

    // .html is a template
    document = await readAsTextDocument(
      join(FORCE_APP_ROOT, 'lwc', 'hello_world', 'hello_world.html'),
      sfdxFileSystemProvider
    );
    expect(await context.isLWCTemplate(document)).toBeTruthy();

    // aura cmps are not a template (sfdx assigns the 'html' language id to aura components)
    document = await readAsTextDocument(
      join(FORCE_APP_ROOT, 'aura', 'helloWorldApp', 'helloWorldApp.app'),
      sfdxFileSystemProvider
    );
    expect(await context.isLWCTemplate(document)).toBeFalsy();

    // html outside namespace roots is not a template
    document = await readAsTextDocument(
      join(FORCE_APP_ROOT, 'aura', 'todoApp', 'randomHtmlInAuraFolder.html'),
      sfdxFileSystemProvider
    );
    expect(await context.isLWCTemplate(document)).toBeFalsy();

    // .html in utils folder is a template
    document = await readAsTextDocument(join(UTILS_ROOT, 'lwc', 'todo_util', 'todo_util.html'), sfdxFileSystemProvider);
    expect(await context.isLWCTemplate(document)).toBeTruthy();
  });

  it('configureProjectForTs()', async () => {
    const context = new LWCWorkspaceContext([SFDX_WORKSPACE_ROOT], sfdxFileSystemProvider);
    context.initialize('SFDX');
    // Mock connection for file operations (required for configureProjectForTs)
    const mockConnection = {
      sendRequest: jest.fn().mockResolvedValue({ applied: true })
    } as any;
    context.connection = mockConnection;
    const baseTsconfigPathForceApp = resolve(join(SFDX_WORKSPACE_ROOT, '.sfdx', 'tsconfig.sfdx.json'));
    const tsconfigPathForceApp = resolve(join(FORCE_APP_ROOT, 'lwc', 'tsconfig.json'));
    const tsconfigPathUtils = resolve(join(UTILS_ROOT, 'lwc', 'tsconfig.json'));
    const tsconfigPathRegisteredEmpty = resolve(join(REGISTERED_EMPTY_FOLDER_ROOT, 'lwc', 'tsconfig.json'));
    const forceignorePath = resolve(join(SFDX_WORKSPACE_ROOT, '.forceignore'));

    // configure and verify typings/jsconfig after configuration:
    await context.configureProjectForTs();

    // verify forceignore
    const forceignoreBuffer = await sfdxFileSystemProvider.getFileContent(forceignorePath);
    if (!forceignoreBuffer) {
      throw new Error('Forceignore file not found');
    }
    const forceignoreContent = Buffer.from(forceignoreBuffer).toString('utf8');
    expect(forceignoreContent).toContain('**/tsconfig.json');
    expect(forceignoreContent).toContain('**/*.ts');

    // verify tsconfig.sfdx.json
    const baseTsConfigBuffer = await sfdxFileSystemProvider.getFileContent(baseTsconfigPathForceApp);
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
          'c/*': []
        }
      }
    });

    //verify newly create tsconfig.json
    const tsconfigBuffer = await sfdxFileSystemProvider.getFileContent(tsconfigPathForceApp);
    if (!tsconfigBuffer) {
      throw new Error('Tsconfig file not found');
    }
    const tsconfigForceAppContent = JSON.parse(Buffer.from(tsconfigBuffer).toString('utf8'));
    expect(tsconfigForceAppContent).toEqual({
      extends: '../../../../.sfdx/tsconfig.sfdx.json',
      include: ['**/*.ts', '../../../../.sfdx/typings/lwc/**/*.d.ts'],
      exclude: ['**/__tests__/**']
    });

    // clean up artifacts
    sfdxFileSystemProvider.updateFileStat(baseTsconfigPathForceApp, {
      type: 'file',
      exists: false,
      ctime: 0,
      mtime: 0,
      size: 0
    });
    sfdxFileSystemProvider.updateFileStat(tsconfigPathForceApp, {
      type: 'file',
      exists: false,
      ctime: 0,
      mtime: 0,
      size: 0
    });
    sfdxFileSystemProvider.updateFileStat(tsconfigPathUtils, {
      type: 'file',
      exists: false,
      ctime: 0,
      mtime: 0,
      size: 0
    });
    sfdxFileSystemProvider.updateFileStat(tsconfigPathRegisteredEmpty, {
      type: 'file',
      exists: false,
      ctime: 0,
      mtime: 0,
      size: 0
    });
    sfdxFileSystemProvider.updateFileStat(forceignorePath, {
      type: 'file',
      exists: false,
      ctime: 0,
      mtime: 0,
      size: 0
    });
  });
});
