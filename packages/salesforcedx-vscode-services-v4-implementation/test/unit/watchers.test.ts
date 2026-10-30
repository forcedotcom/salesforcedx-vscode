/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ChannelService, FileChangePubSub, SettingsChangePubSub, TargetOrgRef } from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Duration from 'effect/Duration';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as PubSub from 'effect/PubSub';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { foundationalWatcherLayers } from '../../src/foundationalLayers.js';
import { FileChangePubSubLayer, SettingsChangePubSubLayer } from '../../src/changePubSubs.js';
import { FileWatcherLayer } from '../../src/fileWatcher.js';
import { SettingsWatcherLayer } from '../../src/settingsWatcher.js';
import { WebFileSystemProvider } from '../../src/webFileSystemProvider.js';

const mockWorkspaceWatchers = () => {
  const created = new Set<(uri: URI) => void>();
  const settings = new Set<(event: vscode.ConfigurationChangeEvent) => void>();
  const listenerDisposals = [vi.fn(), vi.fn(), vi.fn()];
  const disposeWatcher = vi.fn();
  const watcher = {
    onDidCreate: (listener: (uri: URI) => void) => {
      created.add(listener);
      return {
        dispose: () => {
          created.delete(listener);
          listenerDisposals[0]();
        }
      };
    },
    onDidChange: () => ({ dispose: listenerDisposals[1] }),
    onDidDelete: () => ({ dispose: listenerDisposals[2] }),
    dispose: disposeWatcher
  };
  vi.mocked(vscode.workspace.createFileSystemWatcher).mockReturnValue(watcher as unknown as vscode.FileSystemWatcher);
  const disposeSettings = vi.fn();
  const registered = Promise.withResolvers<void>();
  vi.mocked(vscode.workspace.onDidChangeConfiguration).mockImplementation(listener => {
    settings.add(listener);
    registered.resolve();
    return {
      dispose: () => {
        settings.delete(listener);
        disposeSettings();
      }
    };
  });
  return {
    created,
    settings,
    watcher,
    listenerDisposals,
    disposeWatcher,
    disposeSettings,
    registered: registered.promise
  };
};

it('shares one scoped watcher graph, delivers events and releases subscriptions exactly once', async () => {
  const { created, settings, listenerDisposals, disposeWatcher, disposeSettings } = mockWorkspaceWatchers();
  const append = vi.fn(() => Effect.void);
  const graph = foundationalWatcherLayers.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(WebFileSystemProvider, { get: () => undefined }),
        Layer.mock(ChannelService, { appendToChannel: append })
      )
    )
  );
  const runtime = ManagedRuntime.make(Layer.mergeAll(graph, graph));
  const ref = await runtime.runPromise(TargetOrgRef);
  const files = await runtime.runPromise(FileChangePubSub);
  const configurationChanges = await runtime.runPromise(SettingsChangePubSub);
  try {
    expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledExactlyOnceWith('**/*');
    expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalledTimes(1);
    expect(append).toHaveBeenCalledExactlyOnceWith('FileWatcherService started successfully');
    const uri = URI.parse('memfs:/project/a.cls');
    expect(
      await runtime.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const subscription = yield* PubSub.subscribe(files);
            yield* Effect.sync(() => created.forEach(listener => listener(uri)));
            return yield* PubSub.take(subscription);
          })
        )
      )
    ).toEqual({ type: 'create', uri });
    const event = { affectsConfiguration: () => true };
    expect(
      await runtime.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const subscription = yield* PubSub.subscribe(configurationChanges);
            yield* Effect.sync(() => settings.forEach(listener => listener(event)));
            return yield* PubSub.take(subscription);
          })
        )
      )
    ).toBe(event);
  } finally {
    await runtime.dispose();
  }
  expect(disposeWatcher).toHaveBeenCalledTimes(1);
  expect(disposeSettings).toHaveBeenCalledTimes(1);
  listenerDisposals.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
  expect(created.size).toBe(0);
  expect(settings.size).toBe(0);
  expect(await Effect.runPromise(PubSub.isShutdown(files))).toBe(true);
  expect(await Effect.runPromise(PubSub.isShutdown(configurationChanges))).toBe(true);
  expect(await Effect.runPromise(PubSub.isShutdown(ref.pubsub))).toBe(true);
});

it('rolls back both registered watchers when startup fails', async () => {
  const { disposeWatcher, disposeSettings, listenerDisposals, registered } = mockWorkspaceWatchers();
  const defect = new Error('channel startup failed');
  const graph = foundationalWatcherLayers.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(WebFileSystemProvider, { get: () => undefined }),
        Layer.mock(ChannelService, {
          appendToChannel: () => Effect.promise(() => registered).pipe(Effect.andThen(Effect.die(defect)))
        })
      )
    )
  );
  const exit = await Effect.runPromiseExit(Effect.void.pipe(Effect.provide(graph)));
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isFailure(exit))
    expect(exit.cause.reasons.some(reason => reason._tag === 'Die' && reason.defect === defect)).toBe(true);
  expect(disposeWatcher).toHaveBeenCalledTimes(1);
  expect(disposeSettings).toHaveBeenCalledTimes(1);
  listenerDisposals.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
});

it('fails promptly with the original configuration-registration defect', async () => {
  mockWorkspaceWatchers();
  const defect = new Error('configuration registration failed');
  vi.mocked(vscode.workspace.onDidChangeConfiguration).mockImplementation(() => {
    throw defect;
  });
  const layer = SettingsWatcherLayer.pipe(Layer.provide(SettingsChangePubSubLayer));
  const exit = await Effect.runPromiseExit(
    Effect.void.pipe(Effect.provide(layer), Effect.timeout(Duration.millis(200)))
  );
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isFailure(exit))
    expect(exit.cause.reasons.some(reason => reason._tag === 'Die' && reason.defect === defect)).toBe(true);
});

it('fails promptly and releases earlier listeners when file-listener registration fails', async () => {
  const { watcher, created, listenerDisposals, disposeWatcher } = mockWorkspaceWatchers();
  const defect = new Error('file change registration failed');
  watcher.onDidChange = () => {
    throw defect;
  };
  const layer = FileWatcherLayer.pipe(
    Layer.provide(
      Layer.mergeAll(FileChangePubSubLayer, Layer.mock(ChannelService, { appendToChannel: () => Effect.void }))
    )
  );
  const exit = await Effect.runPromiseExit(
    Effect.void.pipe(Effect.provide(layer), Effect.timeout(Duration.millis(200)))
  );
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isFailure(exit))
    expect(exit.cause.reasons.some(reason => reason._tag === 'Die' && reason.defect === defect)).toBe(true);
  expect(disposeWatcher).toHaveBeenCalledTimes(1);
  expect(listenerDisposals[0]).toHaveBeenCalledTimes(1);
  expect(created.size).toBe(0);
});

it('releases every acquired resource when startup is canceled during registration', async () => {
  const { watcher, created, listenerDisposals, disposeWatcher } = mockWorkspaceWatchers();
  const controller = new AbortController();
  const registrations = [
    vi.spyOn(watcher, 'onDidCreate'),
    vi.spyOn(watcher, 'onDidChange'),
    vi.spyOn(watcher, 'onDidDelete')
  ];
  registrations[1].mockImplementation(() => {
    controller.abort();
    return { dispose: listenerDisposals[1] };
  });
  const layer = FileWatcherLayer.pipe(
    Layer.provide(
      Layer.mergeAll(FileChangePubSubLayer, Layer.mock(ChannelService, { appendToChannel: () => Effect.void }))
    )
  );
  const exit = await Effect.runPromiseExit(Effect.void.pipe(Effect.provide(layer)), { signal: controller.signal });
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isFailure(exit)) expect(exit.cause.reasons.some(reason => reason._tag === 'Interrupt')).toBe(true);
  expect(registrations[0]).toHaveBeenCalledTimes(1);
  expect(registrations[1]).toHaveBeenCalledTimes(1);
  listenerDisposals.forEach((dispose, index) =>
    expect(dispose).toHaveBeenCalledTimes(registrations[index].mock.calls.length)
  );
  expect(disposeWatcher).toHaveBeenCalledTimes(1);
  expect(created.size).toBe(0);
});
