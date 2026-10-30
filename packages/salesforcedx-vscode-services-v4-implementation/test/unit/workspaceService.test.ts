/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WorkspaceService } from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { WorkspaceServiceLayer } from '../../src/workspaceService.js';

it('reads newly mounted folders without rebuilding its layer', async () => {
  const folders: vscode.WorkspaceFolder[] = [];
  Object.defineProperty(vscode.workspace, 'workspaceFolders', { configurable: true, get: () => folders });
  const runtime = ManagedRuntime.make(WorkspaceServiceLayer);
  try {
    expect(await runtime.runPromise(WorkspaceService.use(service => service.getWorkspaceInfo()))).toMatchObject({
      isEmpty: true
    });
    expect(
      await runtime.runPromise(WorkspaceService.use(service => service.getWorkspaceInfoOrThrow()).pipe(Effect.flip))
    ).toMatchObject({
      _tag: 'NoWorkspaceOpenError',
      message: 'No workspace is currently open'
    });
    folders.push({ uri: URI.parse('memfs:/dx-project'), name: 'project', index: 0 });
    expect(await runtime.runPromise(WorkspaceService.use(service => service.getWorkspaceInfoOrThrow()))).toMatchObject({
      isEmpty: false,
      isVirtualFs: true,
      path: 'memfs:/dx-project',
      fsPath: '/dx-project'
    });
  } finally {
    await runtime.dispose();
  }
});
