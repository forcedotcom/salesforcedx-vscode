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

jest.mock('@salesforce/core', () => ({
  ...jest.requireActual('@salesforce/core'),
  Config: { getFileName: () => 'config.json' },
  Global: {
    SF_DIR: '/Users/test/.sf',
    SFDX_DIR: '/Users/test/.sfdx'
  }
}));

describe('FileWatcherLayer', () => {
  it('watches the workspace and external Salesforce config files', async () => {
    const watchers = Array.from({ length: 3 }, () => ({
      onDidCreate: jest.fn(),
      onDidChange: jest.fn(),
      onDidDelete: jest.fn(),
      dispose: jest.fn()
    }));
    jest
      .mocked(vscode.workspace.createFileSystemWatcher)
      .mockImplementation(() => watchers.shift() as unknown as vscode.FileSystemWatcher);

    const layer = FileWatcherLayer.pipe(
      Layer.provide(Layer.mergeAll(FileChangePubSub.Default, ChannelService.Default))
    );
    const fiber = Effect.runFork(Layer.launch(layer));
    await Effect.runPromise(Effect.sleep(10));

    const patterns = jest.mocked(vscode.workspace.createFileSystemWatcher).mock.calls.map(([pattern]) => pattern);
    await Effect.runPromise(Fiber.interrupt(fiber));

    expect(patterns[0]).toBe('**/*');
    expect(patterns[1]).toMatchObject({ base: { path: '/Users/test/.sf' }, pattern: 'config.json' });
    expect(patterns[2]).toMatchObject({ base: { path: '/Users/test/.sfdx' }, pattern: 'alias.json' });
  });
});
