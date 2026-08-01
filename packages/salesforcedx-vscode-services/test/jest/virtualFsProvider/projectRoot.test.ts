/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { URI } from 'vscode-uri';
import { getProjectRoot } from '../../../src/virtualFsProvider/projectRoot';
import { WorkspaceService } from '../../../src/vscode/workspaceService';

const run = (folderUri?: string): Promise<{ fsPath: string; uri: URI }> => {
  const uri = folderUri === undefined ? URI.parse('') : URI.parse(folderUri);
  const info = {
    uri,
    path: uri.toString(),
    fsPath: uri.fsPath,
    isEmpty: folderUri === undefined,
    isVirtualFs: uri.scheme !== 'file',
    cwd: '/'
  };
  const layer = Layer.succeed(
    WorkspaceService,
    new WorkspaceService({ getWorkspaceInfo: () => Effect.succeed(info) } as unknown as WorkspaceService)
  );
  return Effect.runPromise(getProjectRoot().pipe(Effect.provide(layer)));
};

// web-only code; URI.fsPath yields backslashes on Windows where this never runs
const describeSkipWindows = process.platform === 'win32' ? describe.skip : describe;

describeSkipWindows('getProjectRoot', () => {
  it('falls back to /dx-project when no workspace folder is open', async () => {
    const root = await run();
    expect({ fsPath: root.fsPath, uri: root.uri.toString() }).toEqual({
      fsPath: '/dx-project',
      uri: 'memfs:/dx-project'
    });
  });

  it('derives from the host-opened memfs folder (the CBW per-org path)', async () => {
    const root = await run('memfs:/org-alpha');
    expect({ fsPath: root.fsPath, uri: root.uri.toString() }).toEqual({
      fsPath: '/org-alpha',
      uri: 'memfs:/org-alpha'
    });
  });

  it('strips a trailing slash so consumers never build a double slash', async () => {
    const root = await run('memfs:/org-alpha/');
    expect({ fsPath: root.fsPath, uri: root.uri.toString() }).toEqual({
      fsPath: '/org-alpha',
      uri: 'memfs:/org-alpha'
    });
  });

  it('falls back for a non-memfs folder (e.g. file: scheme)', async () => {
    const root = await run('file:///Users/me/project');
    expect({ fsPath: root.fsPath, uri: root.uri.toString() }).toEqual({
      fsPath: '/dx-project',
      uri: 'memfs:/dx-project'
    });
  });

  it('falls back when the memfs folder path is empty/root', async () => {
    const root = await run('memfs:/');
    expect({ fsPath: root.fsPath, uri: root.uri.toString() }).toEqual({
      fsPath: '/dx-project',
      uri: 'memfs:/dx-project'
    });
  });
});
