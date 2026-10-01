/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, type SalesforceVSCodeServicesApi } from '@salesforce/effect-ext-utils';
import { ProjectService } from 'salesforcedx-vscode-services/src/core/projectService';
import { FsService } from 'salesforcedx-vscode-services/src/vscode/fsService';
import { NoWorkspaceOpenError, WorkspaceService } from 'salesforcedx-vscode-services/src/vscode/workspaceService';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { getDialogStartingPath } from '../../../src/activation/getDialogStartingPath';
import { LAST_OPENED_LOG_FOLDER_KEY } from '../../../src/debuggerConstants';

jest.mock('vscode');

const debugLogsFolder = URI.file('/mock/.sfdx/tools/debug/logs');
const stateFolder = URI.file('/mock/.sfdx');

/**
 * The source calls the static accessors `api.services.<Service>.<method>()`, which read the service from
 * context. Provide the real classes through the api plus service instances so the accessors resolve and the
 * effect's requirements are satisfied. `FsService.Default` is the real service; it drives
 * `vscode.workspace.fs.stat`, which is mocked below.
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
        services: { WorkspaceService, ProjectService, FsService }
      } as unknown as SalesforceVSCodeServicesApi)
    }),
    Layer.succeed(
      WorkspaceService,
      new WorkspaceService({
        getWorkspaceInfo: () => Effect.succeed(info),
        getWorkspaceInfoOrThrow: () => Effect.succeed(info)
      } as unknown as WorkspaceService)
    ),
    Layer.succeed(
      ProjectService,
      new ProjectService({
        getDebugLogsFolder: () => folderOrClosed(debugLogsFolder),
        getStateFolder: () => folderOrClosed(stateFolder)
      } as unknown as ProjectService)
    ),
    FsService.Default
  );
};

const run = (extContext: vscode.ExtensionContext, isEmpty: boolean, workspaceClosedAfterCheck = false) =>
  Effect.runPromise(
    getDialogStartingPath(extContext).pipe(Effect.provide(provideWorkspace(isEmpty, workspaceClosedAfterCheck)))
  );

describe('getDialogStartingPath', () => {
  const testPath = '/here/is/a/fake/path/to/';
  let mockGet: jest.Mock;
  let mockExtensionContext: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGet = jest.fn();
    mockExtensionContext = {
      workspaceState: { get: mockGet }
    };

    // Mock VSCode workspace.fs.stat to return directory type (exists)
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: vscode.FileType.Directory });
  });

  it('Should return last opened log folder if present', async () => {
    mockGet.mockReturnValue(testPath);
    const vsCodeUriMock = jest.spyOn(URI, 'file').mockReturnValue({ path: testPath } as URI);

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
    (vscode.workspace.fs.stat as jest.Mock).mockRejectedValueOnce(new Error('Not found'));

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
