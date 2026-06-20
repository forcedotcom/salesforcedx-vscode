/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as PubSub from 'effect/PubSub';
import { dirname, normalize } from 'node:path';
import { URI } from 'vscode-uri';
import * as projectService from '../../../src/core/projectService';
import { watchSfProjectFile } from '../../../src/core/sfProjectFileWatcher';
import { FileChangePubSub, type FileChangeEvent } from '../../../src/vscode/fileChangePubSub';

const WORKSPACE_DIR = '/Users/testuser/project';
const PROJECT_FILE_PATH = `${WORKSPACE_DIR}/sfdx-project.json`;
const OTHER_FILE_PATH = `${WORKSPACE_DIR}/.sf/config.json`;

const makeFileChangePubSubLayer = (pubsub: PubSub.PubSub<FileChangeEvent>) =>
  Layer.succeed(FileChangePubSub, pubsub as unknown as FileChangePubSub);

const runWatcherTest = (publishUri: string) => {
  const invalidateSpy = jest.spyOn(projectService, 'invalidateSfProjectCache').mockImplementation(() => Effect.void);

  return Effect.runPromise(
    Effect.gen(function* () {
      const fileChangePubSub = yield* PubSub.sliding<FileChangeEvent>(10);
      const layer = makeFileChangePubSubLayer(fileChangePubSub);

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
  it('invalidates the SfProject cache when sfdx-project.json changes', async () => {
    const spy = await runWatcherTest(PROJECT_FILE_PATH);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('invalidates with the cacheKey getSfProject would compute (dirname of the project file)', async () => {
    const spy = await runWatcherTest(PROJECT_FILE_PATH);
    // parity guard: key must equal the workspace dir so invalidation targets the live entry
    expect(spy).toHaveBeenCalledWith(normalize(dirname(PROJECT_FILE_PATH)));
  });

  it('does not invalidate when a non-project file changes', async () => {
    const spy = await runWatcherTest(OTHER_FILE_PATH);
    expect(spy).not.toHaveBeenCalled();
  });
});
