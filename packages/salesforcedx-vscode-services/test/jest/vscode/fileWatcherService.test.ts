/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { ChannelService } from '../../../src/vscode/channelService';
import { FileChangePubSub } from '../../../src/vscode/fileChangePubSub';
import { FileWatcherLayer } from '../../../src/vscode/fileWatcherService';

describe('FileWatcherLayer', () => {
  it('watches workspace files only', async () => {
    const watcher = {
      onDidCreate: jest.fn(),
      onDidChange: jest.fn(),
      onDidDelete: jest.fn(),
      dispose: jest.fn()
    };
    jest
      .mocked(vscode.workspace.createFileSystemWatcher)
      .mockReturnValue(watcher as unknown as vscode.FileSystemWatcher);

    const layer = FileWatcherLayer.pipe(
      Layer.provide(Layer.mergeAll(FileChangePubSub.Default, ChannelService.Default))
    );
    const fiber = layer.pipe(Layer.launch, Effect.runFork);
    await Effect.runPromise(Effect.sleep(10));

    const patterns = jest.mocked(vscode.workspace.createFileSystemWatcher).mock.calls.map(([pattern]) => pattern);
    await fiber.pipe(Fiber.interrupt, Effect.runPromise);

    expect(patterns).toEqual(['**/*']);
  });
});
