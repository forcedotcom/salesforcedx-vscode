/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfProject } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as PubSub from 'effect/PubSub';
import { normalize } from 'node:path';
import { URI } from 'vscode-uri';
import * as projectService from '../../../src/core/projectService';
import { watchSfProjectFile } from '../../../src/core/sfProjectFileWatcher';
import { FileChangePubSub, type FileChangeEvent } from '../../../src/vscode/fileChangePubSub';
import { WorkspaceService } from '../../../src/vscode/workspaceService';

const WORKSPACE_DIR = '/Users/testuser/project';
const PROJECT_FILE_PATH = `${WORKSPACE_DIR}/sfdx-project.json`;
const OTHER_FILE_PATH = `${WORKSPACE_DIR}/.sf/config.json`;

const makeFileChangePubSubLayer = (pubsub: PubSub.PubSub<FileChangeEvent>) =>
  Layer.succeed(FileChangePubSub, pubsub as unknown as FileChangePubSub);

// The watcher derives its cache key from WorkspaceService (not the event URI). On web the runner UA
// contains "Windows", so the event URI's fsPath is backslashed while WorkspaceService normalizes to `/`;
// keying off WorkspaceService guarantees the key equals the one `getSfProject` used to populate the cache.
const makeWorkspaceServiceLayer = (fsPath: string) =>
  Layer.succeed(WorkspaceService, {
    getWorkspaceInfo: () => Effect.succeed({ fsPath } as never),
    getWorkspaceInfoOrThrow: () => Effect.succeed({ fsPath } as never)
  } as unknown as WorkspaceService);

const runWatcherTest = (publishUri: string, workspaceFsPath = WORKSPACE_DIR) => {
  const invalidateSpy = jest.spyOn(projectService, 'invalidateSfProjectCache').mockImplementation(() => Effect.void);

  return Effect.runPromise(
    Effect.gen(function* () {
      const fileChangePubSub = yield* PubSub.sliding<FileChangeEvent>(10);
      const layer = Layer.merge(
        makeFileChangePubSubLayer(fileChangePubSub),
        makeWorkspaceServiceLayer(workspaceFsPath)
      );

      const fiber = yield* Effect.provide(Effect.scoped(watchSfProjectFile()), layer).pipe(Effect.fork);

      // Yield to allow the forked fiber to subscribe before we publish
      yield* Effect.sleep(0);

      yield* PubSub.publish(fileChangePubSub, { type: 'change' as const, uri: URI.file(publishUri) });
      yield* Effect.sleep(200);

      yield* Fiber.interrupt(fiber);

      return invalidateSpy;
    })
  );
};

describe('watchSfProjectFile', () => {
  afterEach(() => jest.restoreAllMocks());

  it('invalidates the SfProject cache when sfdx-project.json changes', async () => {
    const spy = await runWatcherTest(PROJECT_FILE_PATH);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('invalidates with the cacheKey getSfProject would compute (the WorkspaceService fsPath)', async () => {
    const spy = await runWatcherTest(PROJECT_FILE_PATH);
    // parity guard: key must equal the workspace dir from WorkspaceService so invalidation targets the
    // live entry — NOT the event URI's dirname, which is backslashed on web and would never match.
    expect(spy).toHaveBeenCalledWith(normalize(WORKSPACE_DIR));
  });

  it('does not invalidate when a non-project file changes', async () => {
    const spy = await runWatcherTest(OTHER_FILE_PATH);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('invalidateSfProjectCache', () => {
  afterEach(() => jest.restoreAllMocks());

  it('clears the @salesforce/core SfProject instance cache so memoized sfProjectJson is dropped', async () => {
    // Without clearInstances, SfProject.resolve returns the same memoized instance (sfProject.js:436),
    // whose parsed sfProjectJson is also memoized (sfProject.js:468) -> stale sourceApiVersion survives.
    const clearSpy = jest.spyOn(SfProject, 'clearInstances').mockImplementation(() => {});
    await Effect.runPromise(projectService.invalidateSfProjectCache('/Users/testuser/project'));
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });
});
