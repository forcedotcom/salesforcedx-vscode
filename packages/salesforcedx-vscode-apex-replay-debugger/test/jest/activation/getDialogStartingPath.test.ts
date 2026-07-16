/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, type SalesforceVSCodeServicesApi } from '@salesforce/effect-ext-utils';
import { projectPaths } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { getDialogStartingPath } from '../../../src/activation/getDialogStartingPath';
import { LAST_OPENED_LOG_FOLDER_KEY } from '../../../src/debuggerConstants';

jest.mock('vscode');

/** Layer that reports the workspace as empty/non-empty through the services-extension API. */
const provideWorkspace = (isEmpty: boolean) =>
  Layer.succeed(ExtensionProviderService, {
    getServicesApi: Effect.succeed({
      services: { WorkspaceService: { getWorkspaceInfo: () => Effect.succeed({ isEmpty }) } }
    } as unknown as SalesforceVSCodeServicesApi)
  });

const run = (extContext: vscode.ExtensionContext, isEmpty: boolean) =>
  Effect.runPromise(getDialogStartingPath(extContext).pipe(Effect.provide(provideWorkspace(isEmpty))));

describe('getDialogStartingPath', () => {
  const testPath = '/here/is/a/fake/path/to/';
  let mockGet: jest.Mock;
  let mockExtensionContext: any;
  let vsCodeUriMock: jest.SpyInstance;
  let debugLogsFolderMock: jest.SpyInstance;
  let stateFolderMock: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGet = jest.fn();
    mockExtensionContext = {
      workspaceState: { get: mockGet }
    };
    vsCodeUriMock = jest.spyOn(URI, 'file');
    debugLogsFolderMock = jest.spyOn(projectPaths, 'debugLogsFolder');
    stateFolderMock = jest.spyOn(projectPaths, 'stateFolder');

    // Mock VSCode workspace.fs.stat to return directory type (exists)
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: vscode.FileType.Directory });
  });

  it('Should return last opened log folder if present', async () => {
    mockGet.mockReturnValue(testPath);
    vsCodeUriMock.mockReturnValue({ path: testPath } as URI);

    const dialogStartingPathUri = await run(mockExtensionContext, false);

    expect(mockGet).toHaveBeenCalledWith(LAST_OPENED_LOG_FOLDER_KEY);
    expect(vscode.workspace.fs.stat).toHaveBeenCalled();
    expect(vsCodeUriMock).toHaveBeenCalledWith(testPath);
    expect((dialogStartingPathUri as URI).path).toEqual(testPath);
  });

  it('Should return project log folder when last opened log folder not present', async () => {
    mockGet.mockReturnValue(undefined);
    const fakePathToDebugLogsFolder = 'path/to/debug/logs';
    debugLogsFolderMock.mockReturnValue(fakePathToDebugLogsFolder);
    vsCodeUriMock.mockReturnValue({
      path: fakePathToDebugLogsFolder
    } as URI);

    const dialogStartingPathUri = await run(mockExtensionContext, false);

    expect(mockGet).toHaveBeenCalledWith(LAST_OPENED_LOG_FOLDER_KEY);
    expect(vscode.workspace.fs.stat).toHaveBeenCalled();
    expect(vsCodeUriMock).toHaveBeenCalledWith(fakePathToDebugLogsFolder);
    expect((dialogStartingPathUri as URI).path).toEqual(fakePathToDebugLogsFolder);
  });

  it('Should return state folder as fallback when project log folder not present', async () => {
    mockGet.mockReturnValue(undefined);
    const fakePathToDebugLogsFolder = 'path/to/debug/logs';
    debugLogsFolderMock.mockReturnValue(fakePathToDebugLogsFolder);
    // Mock that the debug logs folder doesn't exist
    (vscode.workspace.fs.stat as jest.Mock).mockRejectedValueOnce(new Error('Not found'));
    const fakePathToStateFolder = 'path/to/state';
    stateFolderMock.mockReturnValue(fakePathToStateFolder);
    vsCodeUriMock.mockReturnValue({
      path: fakePathToStateFolder
    } as URI);

    const dialogStartingPathUri = await run(mockExtensionContext, false);

    expect(mockGet).toHaveBeenCalledWith(LAST_OPENED_LOG_FOLDER_KEY);
    expect(vscode.workspace.fs.stat).toHaveBeenCalled();
    expect(vsCodeUriMock).toHaveBeenCalledWith(fakePathToStateFolder);
    expect((dialogStartingPathUri as URI).path).toEqual(fakePathToStateFolder);
  });

  it('Should return undefined when not in a project workspace', async () => {
    mockGet.mockReturnValue(testPath);

    const dialogStartingPathUri = await run(mockExtensionContext, true);

    expect(dialogStartingPathUri as URI).toBeUndefined();
  });
});
