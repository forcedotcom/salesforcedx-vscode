/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import { URI } from 'vscode-uri';
import { ProjectService } from '../../../src/core/projectService';
import { NoWorkspaceOpenError, WorkspaceService } from '../../../src/vscode/workspaceService';

const workspaceLayer = (uri: URI | undefined) =>
  Layer.succeed(
    WorkspaceService,
    new WorkspaceService({
      getWorkspaceInfoOrThrow: () =>
        uri
          ? Effect.succeed({
              uri,
              path: uri.toString(),
              fsPath: uri.fsPath,
              isEmpty: false,
              isVirtualFs: uri.scheme !== 'file',
              cwd: uri.fsPath
            })
          : Effect.fail(new NoWorkspaceOpenError({ message: 'No workspace is currently open' }))
    } as unknown as WorkspaceService)
  );

const layerFor = (uri: URI | undefined) => Layer.provide(ProjectService.DefaultWithoutDependencies, workspaceLayer(uri));

const pathOf = (folder: 'getStateFolder' | 'getDebugLogsFolder' | 'getApexTestResultsFolder', uri: URI) =>
  Effect.runPromise(
    Effect.map(ProjectService[folder](), result => result.path).pipe(Effect.provide(layerFor(uri)))
  );

describe('ProjectService folder URIs', () => {
  const workspace = URI.file('/project');

  it('getStateFolder is the workspace .sfdx folder', async () => {
    expect(await pathOf('getStateFolder', workspace)).toBe('/project/.sfdx');
  });

  it('getDebugLogsFolder is .sfdx/tools/debug/logs', async () => {
    expect(await pathOf('getDebugLogsFolder', workspace)).toBe('/project/.sfdx/tools/debug/logs');
  });

  it('getApexTestResultsFolder is .sfdx/tools/testresults/apex', async () => {
    expect(await pathOf('getApexTestResultsFolder', workspace)).toBe('/project/.sfdx/tools/testresults/apex');
  });

  it('works for a virtual (memfs) workspace', async () => {
    expect(await pathOf('getDebugLogsFolder', URI.parse('memfs:/dx-project'))).toBe(
      '/dx-project/.sfdx/tools/debug/logs'
    );
  });

  it.each(['getStateFolder', 'getDebugLogsFolder', 'getApexTestResultsFolder'] as const)(
    '%s fails with NoWorkspaceOpenError when no workspace is open',
    async folder => {
      const exit = await Effect.runPromiseExit(ProjectService[folder]().pipe(Effect.provide(layerFor(undefined))));

      expect(Exit.isFailure(exit)).toBe(true);
      expect(
        Exit.isFailure(exit) ? Option.getOrUndefined(Cause.failureOption(exit.cause)) : undefined
      ).toBeInstanceOf(NoWorkspaceOpenError);
    }
  );
});
