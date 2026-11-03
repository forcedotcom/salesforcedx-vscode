/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Mock as VitestMock } from 'vitest';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import {
  FsService,
  NoWorkspaceOpenError,
  ProjectService,
  WorkspaceService,
  type SalesforceVSCodeServicesApiV2
} from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { getDialogStartingPath } from '../../../src/activation/getDialogStartingPath';
import { LAST_OPENED_LOG_FOLDER_KEY } from '../../../src/debuggerConstants';

vi.mock('vscode');

const debugLogsFolder = URI.file('/mock/.sfdx/tools/debug/logs');
const stateFolder = URI.file('/mock/.sfdx');

/**
 * Provide V2 service tags through the API and mock their Context.Service values.
 */
const provideWorkspace = (isEmpty: boolean, workspaceClosedAfterCheck = false) => {
  const info = { path: '/mock', fsPath: '/mock', isEmpty, isVirtualFs: false, cwd: '/mock' } as const;
  // ProjectService re-reads the workspace folders, so it can fail after the isEmpty check passed
  const folderOrClosed = (folder: URI) =>
    workspaceClosedAfterCheck
      ? Effect.fail(new NoWorkspaceOpenError({ message: 'No workspace is currently open' }))
      : Effect.succeed(folder);
  return Layer.mergeAll(
    Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed({
        v2: { services: { WorkspaceService, ProjectService, FsService } }
      } as unknown as SalesforceVSCodeServicesApiV2)
    } as unknown as ExtensionProviderService['Service']),
    Layer.succeed(WorkspaceService, {
      getWorkspaceInfo: () => Effect.succeed(info),
      getWorkspaceInfoOrThrow: () => Effect.succeed(info)
    } as unknown as WorkspaceService['Service']),
    Layer.succeed(ProjectService, {
      getDebugLogsFolder: () => folderOrClosed(debugLogsFolder),
      getStateFolder: () => folderOrClosed(stateFolder)
    } as unknown as ProjectService['Service']),
    Layer.succeed(FsService, {
      fileOrFolderExists: (path: string | URI) =>
        Effect.tryPromise({
          try: () => vscode.workspace.fs.stat(typeof path === 'string' ? URI.file(path) : path),
          catch: () => false
        }).pipe(
          Effect.as(true),
          Effect.catch(() => Effect.succeed(false))
        )
    } as unknown as FsService['Service'])
  );
};

const run = (extContext: vscode.ExtensionContext, isEmpty: boolean, workspaceClosedAfterCheck = false) =>
  Effect.runPromise(
    getDialogStartingPath(extContext).pipe(Effect.provide(provideWorkspace(isEmpty, workspaceClosedAfterCheck)))
  );

describe('getDialogStartingPath', () => {
  const testPath = '/here/is/a/fake/path/to/';
  let mockGet: VitestMock;
  let mockExtensionContext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet = vi.fn();
    mockExtensionContext = {
      workspaceState: { get: mockGet }
    };

    // Mock VSCode workspace.fs.stat to return directory type (exists)
    (vscode.workspace.fs.stat as VitestMock).mockResolvedValue({ type: vscode.FileType.Directory });
  });

  it('Should return last opened log folder if present', async () => {
    mockGet.mockReturnValue(testPath);
    const vsCodeUriMock = vi.spyOn(URI, 'file').mockReturnValue({ path: testPath } as URI);

    const dialogStartingPathUri = await run(mockExtensionContext, false);

    expect(mockGet).toHaveBeenCalledWith(LAST_OPENED_LOG_FOLDER_KEY);
    expect(vscode.workspace.fs.stat).toHaveBeenCalled();
    expect(vsCodeUriMock).toHaveBeenCalledWith(testPath);
    expect((dialogStartingPathUri as URI).path).toEqual(testPath);
  });

  it('Should return project log folder when last opened log folder not present', async () => {
    mockGet.mockReturnValue(undefined);

    const dialogStartingPathUri = await run(mockExtensionContext, false);

    expect(mockGet).toHaveBeenCalledWith(LAST_OPENED_LOG_FOLDER_KEY);
    expect(vscode.workspace.fs.stat).toHaveBeenCalled();
    expect((dialogStartingPathUri as URI).path).toEqual(debugLogsFolder.path);
  });

  it('Should return state folder as fallback when project log folder not present', async () => {
    mockGet.mockReturnValue(undefined);
    // Mock that the debug logs folder doesn't exist
    (vscode.workspace.fs.stat as VitestMock).mockRejectedValueOnce(new Error('Not found'));

    const dialogStartingPathUri = await run(mockExtensionContext, false);

    expect(mockGet).toHaveBeenCalledWith(LAST_OPENED_LOG_FOLDER_KEY);
    expect(vscode.workspace.fs.stat).toHaveBeenCalled();
    expect((dialogStartingPathUri as URI).path).toEqual(stateFolder.path);
  });

  it('Should return undefined when the workspace closes after the isEmpty check', async () => {
    mockGet.mockReturnValue(undefined);

    const dialogStartingPathUri = await run(mockExtensionContext, false, true);

    expect(dialogStartingPathUri as URI).toBeUndefined();
  });

  it('Should return undefined when not in a project workspace', async () => {
    mockGet.mockReturnValue(testPath);

    const dialogStartingPathUri = await run(mockExtensionContext, true);

    expect(dialogStartingPathUri as URI).toBeUndefined();
  });
});
