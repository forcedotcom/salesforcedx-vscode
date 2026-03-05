/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { normalizePath, WORKSPACE_FIND_FILES_REQUEST } from '@salesforce/salesforcedx-lightning-lsp-common';
import {
  buildSfdxContentMap,
  createMockWorkspaceFindFilesConnection,
  DIR_STAT,
  FILE_STAT,
  FORCE_APP_ROOT,
  getSfdxWorkspaceRelativePaths,
  readAsTextDocument,
  REGISTERED_EMPTY_FOLDER_ROOT,
  SFDX_WORKSPACE_ROOT,
  sfdxFileSystemAccessor,
  UTILS_ROOT
} from '@salesforce/salesforcedx-lightning-lsp-common/testUtils';
import { join, resolve } from 'node:path';
import { Connection } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { LWCWorkspaceContext } from '../context/lwcContext';

const contentMap = buildSfdxContentMap();

beforeAll(() => {
  sfdxFileSystemAccessor.setWorkspaceFolderUris([URI.file(SFDX_WORKSPACE_ROOT).toString()]);
  sfdxFileSystemAccessor.setFindFilesFromConnection(
    createMockWorkspaceFindFilesConnection(SFDX_WORKSPACE_ROOT, {
      relativePaths: getSfdxWorkspaceRelativePaths()
    }) as Parameters<typeof sfdxFileSystemAccessor.setFindFilesFromConnection>[0],
    WORKSPACE_FIND_FILES_REQUEST
  );

  jest.spyOn(sfdxFileSystemAccessor, 'getFileStat').mockImplementation((uri: string) => {
    const key = normalizePath(uri);
    if (contentMap.has(key)) return Promise.resolve(FILE_STAT);
    const prefix = `${key}/`;
    for (const k of contentMap.keys()) {
      if (k.startsWith(prefix)) return Promise.resolve(DIR_STAT);
    }
    return Promise.resolve(undefined);
  });
  jest
    .spyOn(sfdxFileSystemAccessor, 'getFileContent')
    .mockImplementation((uri: string) => Promise.resolve(contentMap.get(normalizePath(uri))));
  jest.spyOn(sfdxFileSystemAccessor, 'updateFileContent').mockImplementation((uri: string, content: string) => {
    contentMap.set(normalizePath(uri), content);
    return Promise.resolve();
  });
  jest.spyOn(sfdxFileSystemAccessor, 'deleteFile').mockImplementation((pathOrUri: string) => {
    contentMap.delete(normalizePath(pathOrUri));
    return Promise.resolve();
  });
});

describe('LWCWorkspaceContext', () => {
  it('isLWCJavascript()', async () => {
    const context = new LWCWorkspaceContext([SFDX_WORKSPACE_ROOT], sfdxFileSystemAccessor);
    context.initialize('SFDX');

    // lwc .js
    let document = await readAsTextDocument(
      join(FORCE_APP_ROOT, 'lwc', 'hello_world', 'hello_world.js'),
      sfdxFileSystemAccessor
    );
    expect(await context.isLWCJavascript(document)).toBeTruthy();

    // lwc .htm
    document = await readAsTextDocument(
      join(FORCE_APP_ROOT, 'lwc', 'hello_world', 'hello_world.html'),
      sfdxFileSystemAccessor
    );
    expect(await context.isLWCJavascript(document)).toBeFalsy();

    // aura cmps
    document = await readAsTextDocument(
      join(FORCE_APP_ROOT, 'aura', 'helloWorldApp', 'helloWorldApp.app'),
      sfdxFileSystemAccessor
    );
    expect(await context.isLWCJavascript(document)).toBeFalsy();

    // .js outside namespace roots
    document = await readAsTextDocument(
      join(FORCE_APP_ROOT, 'aura', 'todoApp', 'randomJsInAuraFolder.js'),
      sfdxFileSystemAccessor
    );
    expect(await context.isLWCJavascript(document)).toBeFalsy();

    // lwc .js in utils
    document = await readAsTextDocument(join(UTILS_ROOT, 'lwc', 'todo_util', 'todo_util.js'), sfdxFileSystemAccessor);
    expect(await context.isLWCJavascript(document)).toBeTruthy();
  });

  it('isInsideModulesRoots()', async () => {
    const context = new LWCWorkspaceContext([SFDX_WORKSPACE_ROOT], sfdxFileSystemAccessor);
    context.initialize('SFDX');

    let document = await readAsTextDocument(
      join(FORCE_APP_ROOT, 'lwc', 'hello_world', 'hello_world.js'),
      sfdxFileSystemAccessor
    );
    expect(await context.isInsideModulesRoots(document)).toBeTruthy();

    document = await readAsTextDocument(
      join(FORCE_APP_ROOT, 'aura', 'helloWorldApp', 'helloWorldApp.app'),
      sfdxFileSystemAccessor
    );
    expect(await context.isInsideModulesRoots(document)).toBeFalsy();

    document = await readAsTextDocument(join(UTILS_ROOT, 'lwc', 'todo_util', 'todo_util.js'), sfdxFileSystemAccessor);
    expect(await context.isInsideModulesRoots(document)).toBeTruthy();
  });

  it('isLWCTemplate()', async () => {
    const context = new LWCWorkspaceContext([SFDX_WORKSPACE_ROOT], sfdxFileSystemAccessor);
    context.initialize('SFDX');

    // .js is not a template
    let document = await readAsTextDocument(
      join(FORCE_APP_ROOT, 'lwc', 'hello_world', 'hello_world.js'),
      sfdxFileSystemAccessor
    );
    expect(await context.isLWCTemplate(document)).toBeFalsy();

    // .html is a template
    document = await readAsTextDocument(
      join(FORCE_APP_ROOT, 'lwc', 'hello_world', 'hello_world.html'),
      sfdxFileSystemAccessor
    );
    expect(await context.isLWCTemplate(document)).toBeTruthy();

    // aura cmps are not a template (sfdx assigns the 'html' language id to aura components)
    document = await readAsTextDocument(
      join(FORCE_APP_ROOT, 'aura', 'helloWorldApp', 'helloWorldApp.app'),
      sfdxFileSystemAccessor
    );
    expect(await context.isLWCTemplate(document)).toBeFalsy();

    // html outside namespace roots is not a template
    document = await readAsTextDocument(
      join(FORCE_APP_ROOT, 'aura', 'todoApp', 'randomHtmlInAuraFolder.html'),
      sfdxFileSystemAccessor
    );
    expect(await context.isLWCTemplate(document)).toBeFalsy();

    // .html in utils folder is a template
    document = await readAsTextDocument(join(UTILS_ROOT, 'lwc', 'todo_util', 'todo_util.html'), sfdxFileSystemAccessor);
    expect(await context.isLWCTemplate(document)).toBeTruthy();
  });

  it('configureProjectForTs()', async () => {
    const context = new LWCWorkspaceContext([SFDX_WORKSPACE_ROOT], sfdxFileSystemAccessor);
    context.initialize('SFDX');
    context.connection = {
      sendRequest: jest.fn().mockResolvedValue({ applied: true })
    } as unknown as Connection;
    const baseTsconfigPathForceApp = resolve(join(SFDX_WORKSPACE_ROOT, '.sfdx', 'tsconfig.sfdx.json'));
    const tsconfigPathForceApp = resolve(join(FORCE_APP_ROOT, 'lwc', 'tsconfig.json'));
    const tsconfigPathUtils = resolve(join(UTILS_ROOT, 'lwc', 'tsconfig.json'));
    const tsconfigPathRegisteredEmpty = resolve(join(REGISTERED_EMPTY_FOLDER_ROOT, 'lwc', 'tsconfig.json'));
    const forceignorePath = resolve(join(SFDX_WORKSPACE_ROOT, '.forceignore'));

    // configure and verify typings/jsconfig after configuration:
    await context.configureProjectForTs();

    // verify forceignore
    const forceignoreBuffer = await sfdxFileSystemAccessor.getFileContent(forceignorePath);
    if (!forceignoreBuffer) {
      throw new Error('Forceignore file not found');
    }
    const forceignoreContent = Buffer.from(forceignoreBuffer).toString('utf8');
    expect(forceignoreContent).toContain('**/tsconfig.json');
    expect(forceignoreContent).toContain('**/*.ts');

    // verify tsconfig.sfdx.json
    const baseTsConfigBuffer = await sfdxFileSystemAccessor.getFileContent(baseTsconfigPathForceApp);
    if (!baseTsConfigBuffer) {
      throw new Error('Base tsconfig file not found');
    }
    const baseTsConfigForceAppContent = JSON.parse(baseTsConfigBuffer) as Record<string, unknown>;
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
    const tsconfigBuffer = await sfdxFileSystemAccessor.getFileContent(tsconfigPathForceApp);
    if (!tsconfigBuffer) {
      throw new Error('Tsconfig file not found');
    }
    const tsconfigForceAppContent = JSON.parse(Buffer.from(tsconfigBuffer).toString('utf8')) as Record<string, unknown>;
    expect(tsconfigForceAppContent).toEqual({
      extends: '../../../../.sfdx/tsconfig.sfdx.json',
      include: ['**/*.ts', '../../../../.sfdx/typings/lwc/**/*.d.ts'],
      exclude: ['**/__tests__/**']
    });

    // clean up artifacts
    await sfdxFileSystemAccessor.deleteFile(baseTsconfigPathForceApp);
    await sfdxFileSystemAccessor.deleteFile(tsconfigPathForceApp);
    await sfdxFileSystemAccessor.deleteFile(tsconfigPathUtils);
    await sfdxFileSystemAccessor.deleteFile(tsconfigPathRegisteredEmpty);
    await sfdxFileSystemAccessor.deleteFile(forceignorePath);
  });
});
