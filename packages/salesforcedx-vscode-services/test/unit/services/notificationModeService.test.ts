/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ChannelService, NotificationModeService } from '@salesforce/vscode-services/v2';
import * as Clock from 'effect/Clock';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as TestClock from 'effect/testing/TestClock';
import * as vscode from 'vscode';
import type { MockInstance } from 'vitest';
import { makeChannelServiceLayer } from '../../../src/services/channelService.js';
import { makeNotificationModeServiceLayer } from '../../../src/services/notificationModeService.js';
import { getInternalMode, normalizeToInternal } from '../../../src/services/notificationModes.js';

type Explicit = {
  readonly globalValue?: unknown;
  readonly workspaceValue?: unknown;
  readonly workspaceFolderValue?: unknown;
  readonly defaultValue?: unknown;
};
const setConfig = (values: {
  readonly command?: Explicit;
  readonly extension?: Explicit;
  readonly global?: unknown;
}) => {
  vi.spyOn(vscode.workspace, 'getConfiguration').mockImplementation(
    section =>
      ({
        inspect: () =>
          section === 'ext.commandLevelNotifications'
            ? { key: 'command', ...values.command }
            : { key: 'extension', ...values.extension },
        get: () => values.global,
        has: () => false,
        update: () => Promise.resolve()
      }) as unknown as vscode.WorkspaceConfiguration
  );
};
const callbacks = new Map<string, Parameters<typeof vscode.commands.registerCommand>[1]>();
const disposedCommands: string[] = [];
const item = {
  name: '',
  text: '',
  command: undefined as string | undefined,
  show: vi.fn(),
  hide: vi.fn(),
  dispose: vi.fn()
};
let information: MockInstance;
let errorToast: MockInstance;
beforeEach(() => {
  callbacks.clear();
  disposedCommands.length = 0;
  item.name = '';
  item.text = '';
  item.command = undefined;
  item.show.mockReset();
  item.hide.mockReset();
  item.dispose.mockReset();
  const createItem: MockInstance = vi.mocked(vscode.window.createStatusBarItem);
  createItem.mockReturnValue(item);
  vi.mocked(vscode.commands.registerCommand).mockImplementation((id, callback) => {
    callbacks.set(id, callback);
    return {
      dispose: () => {
        callbacks.delete(id);
        disposedCommands.push(id);
      }
    };
  });
  information = vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined);
  errorToast = vi.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined);
  setConfig({ global: 'progressToastSuccessToast' });
});
afterEach(() => vi.restoreAllMocks());
const makeRuntime = () =>
  ManagedRuntime.make(makeNotificationModeServiceLayer('ext', 'fixture.status', 'Fixture status'));
const makeClockRuntime = () =>
  ManagedRuntime.make(
    makeNotificationModeServiceLayer('ext', 'fixture.status', 'Fixture status').pipe(
      Layer.provideMerge(TestClock.layer())
    )
  );
const clockWithSleep = (sleep: Clock.Clock['sleep']): Clock.Clock => {
  const live = Effect.runSync(Clock.Clock);
  return {
    currentTimeMillisUnsafe: () => live.currentTimeMillisUnsafe(),
    currentTimeMillis: live.currentTimeMillis,
    currentTimeNanosUnsafe: () => live.currentTimeNanosUnsafe(),
    currentTimeNanos: live.currentTimeNanos,
    monotonicTimeNanosUnsafe: () => live.monotonicTimeNanosUnsafe(),
    monotonicTimeNanos: live.monotonicTimeNanos,
    sleep
  };
};

it.each([
  ['progressToastSuccessToast', 'progressToastSuccessToast'],
  ['progressToastSuccessOff', 'progressToastSuccessOff'],
  ['progressStatusBarSuccessStatusBar', 'progressStatusBarSuccessStatusBar'],
  ['progressStatusBarSuccessOff', 'progressStatusBarSuccessOff'],
  ['progressToast', 'progressToastSuccessOff'],
  ['progressStatusBar', 'progressStatusBarSuccessOff'],
  ['successToast', 'progressToastSuccessToast'],
  ['successStatusBar', 'progressStatusBarSuccessStatusBar'],
  ['successOff', 'progressToastSuccessOff']
] as const)('normalizes %s without changing its progress/success meaning', (raw, expected) => {
  expect(normalizeToInternal(raw)).toBe(expected);
});

it.each([
  [
    {
      command: { globalValue: 'progressToast', workspaceValue: 'successStatusBar', workspaceFolderValue: 'successOff' },
      extension: { globalValue: 'progressStatusBarSuccessStatusBar' }
    },
    'progressToastSuccessOff'
  ],
  [
    { command: { globalValue: 'progressToast', workspaceValue: 'successStatusBar' } },
    'progressStatusBarSuccessStatusBar'
  ],
  [{ command: { globalValue: 'successToast' } }, 'progressToastSuccessToast'],
  [
    { command: { defaultValue: 'successOff' }, extension: { globalValue: 'progressStatusBarSuccessStatusBar' } },
    'progressStatusBarSuccessStatusBar'
  ],
  [
    {
      command: { workspaceFolderValue: 'invalid', globalValue: 'successOff' },
      extension: { globalValue: 'progressStatusBarSuccessOff' }
    },
    'progressStatusBarSuccessOff'
  ],
  [
    { extension: { workspaceFolderValue: 'progressStatusBarSuccessOff', workspaceValue: 'progressToastSuccessOff' } },
    'progressStatusBarSuccessOff'
  ],
  [
    { extension: { workspaceValue: 'progressToastSuccessOff', globalValue: 'progressStatusBarSuccessStatusBar' } },
    'progressToastSuccessOff'
  ],
  [
    {
      extension: { workspaceFolderValue: 'invalid', globalValue: 'progressToastSuccessOff' },
      global: 'progressStatusBarSuccessStatusBar'
    },
    'progressStatusBarSuccessStatusBar'
  ],
  [
    {
      command: { globalValue: 'invalid' },
      extension: { globalValue: 'successOff' },
      global: 'progressStatusBarSuccessOff'
    },
    'progressStatusBarSuccessOff'
  ],
  [{ global: 'invalid' }, 'progressToastSuccessToast'],
  [{ global: 'successOff' }, 'progressToastSuccessToast']
] as const)('preserves explicit setting precedence %#', (config, expected) => {
  setConfig(config);
  expect(getInternalMode('ext', 'ext.commandLevelNotifications', 'Command')).toBe(expected);
});

it.each([
  ['progressToastSuccessOff', vscode.ProgressLocation.Notification, 'toast'],
  ['progressStatusBarSuccessOff', vscode.ProgressLocation.Window, 'status']
] as const)('force-show upgrades %s without changing progress placement', async (mode, location, visible) => {
  setConfig({ extension: { globalValue: mode } });
  const runtime = makeRuntime();
  try {
    const service = await runtime.runPromise(NotificationModeService);
    expect(await runtime.runPromise(service.getProgressLocation('Command'))).toBe(location);
    await runtime.runPromise(service.showSuccessNotification('Command', 'hidden'));
    expect(information).not.toHaveBeenCalled();
    expect(item.show).not.toHaveBeenCalled();
    await runtime.runPromise(service.showSuccessNotification('Command', 'forced', true));
    if (visible === 'toast') expect(information).toHaveBeenCalledWith('forced');
    else expect(item.text).toBe('$(check) forced');
  } finally {
    await runtime.dispose();
  }
});

it('returns without awaiting an action-free toast or a pending action selection', async () => {
  information.mockReturnValue(new Promise(() => {}));
  const runtime = makeRuntime();
  try {
    const service = await runtime.runPromise(NotificationModeService);
    await runtime.runPromise(service.showSuccessNotification('Command', 'first'));
    const action = vi.fn();
    await runtime.runPromise(
      service.showSuccessNotification('Command', 'second', false, [{ label: 'Open', run: action }])
    );
    expect(information).toHaveBeenCalledWith('first');
    expect(information).toHaveBeenCalledWith('second', 'Open');
    expect(action).not.toHaveBeenCalled();
  } finally {
    await runtime.dispose();
  }
});

it.each(['success', 'error'] as const)('runs a selected %s action after the showing call returned', async kind => {
  const selection = Promise.withResolvers<string | undefined>();
  const ran = Promise.withResolvers<void>();
  const action = vi.fn(() => ran.resolve());
  (kind === 'success' ? information : errorToast).mockReturnValueOnce(selection.promise);
  setConfig({ global: kind === 'success' ? 'progressToastSuccessToast' : 'progressToastSuccessOff' });
  const runtime = makeRuntime();
  try {
    const service = await runtime.runPromise(NotificationModeService);
    await runtime.runPromise(
      kind === 'success'
        ? service.showSuccessNotification('Command', 'message', false, [{ label: 'Open', run: action }])
        : service.showErrorWithActions('message', [{ label: 'Open', run: action }])
    );
    expect(action).not.toHaveBeenCalled();
    selection.resolve('Open');
    await ran.promise;
    expect(action).toHaveBeenCalledTimes(1);
    expect(item.show).not.toHaveBeenCalled();
  } finally {
    await runtime.dispose();
  }
});

it('reports action rejection without turning it into an unhandled Promise', async () => {
  const reported = Promise.withResolvers<string>();
  information.mockResolvedValueOnce('Open');
  errorToast.mockImplementationOnce((message: string) => {
    reported.resolve(message);
    return Promise.resolve(undefined);
  });
  const runtime = makeRuntime();
  try {
    await runtime.runPromise(
      NotificationModeService.use(service =>
        service.showSuccessNotification('Command', 'done', false, [
          { label: 'Open', run: () => Promise.reject(new Error('Action failed')) }
        ])
      )
    );
    expect(await reported.promise).toBe('Error: Action failed');
  } finally {
    await runtime.dispose();
  }
});

it('does not run actions for dismissed or late selections after scope closure', async () => {
  const dismissed = Promise.withResolvers<string | undefined>();
  const late = Promise.withResolvers<string | undefined>();
  const action = vi.fn();
  information.mockReturnValueOnce(dismissed.promise).mockReturnValueOnce(late.promise);
  const runtime = makeRuntime();
  const service = await runtime.runPromise(NotificationModeService);
  await runtime.runPromise(
    service.showSuccessNotification('Command', 'dismiss', false, [{ label: 'Open', run: action }])
  );
  dismissed.resolve(undefined);
  await dismissed.promise;
  await runtime.runPromise(service.showSuccessNotification('Command', 'late', false, [{ label: 'Open', run: action }]));
  await runtime.dispose();
  late.resolve('Open');
  await late.promise;
  expect(action).not.toHaveBeenCalled();
  expect(item.dispose).toHaveBeenCalledTimes(1);
  expect(disposedCommands).toEqual(['fixture.status.showToast']);
});

it('keeps actions that await their owning runtime disposal from deadlocking', async () => {
  const finished = Promise.withResolvers<void>();
  information.mockResolvedValueOnce('Close');
  const runtime = makeRuntime();
  await runtime.runPromise(
    NotificationModeService.use(service =>
      service.showSuccessNotification('Command', 'done', false, [
        {
          label: 'Close',
          run: async () => {
            await Promise.resolve();
            await runtime.dispose();
            finished.resolve();
          }
        }
      ])
    )
  );
  await finished.promise;
  expect(item.dispose).toHaveBeenCalledTimes(1);
  expect(callbacks.has('fixture.status.showToast')).toBe(false);
});

it('does not join an arbitrary started native action Promise during disposal', async () => {
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  information.mockResolvedValueOnce('Open');
  const runtime = makeRuntime();
  try {
    await runtime.runPromise(
      NotificationModeService.use(service =>
        service.showSuccessNotification('Command', 'done', false, [
          {
            label: 'Open',
            run: () => {
              started.resolve();
              return release.promise;
            }
          }
        ])
      )
    );
    await started.promise;
    await runtime.dispose();
    expect(item.dispose).toHaveBeenCalledTimes(1);
  } finally {
    release.resolve();
    await runtime.dispose();
  }
});

it('resets the five-second timer and uses the latest status message when clicked', async () => {
  setConfig({ global: 'progressStatusBarSuccessStatusBar' });
  const runtime = makeClockRuntime();
  try {
    const service = await runtime.runPromise(NotificationModeService);
    await runtime.runPromise(service.showSuccessNotification('Command', 'first'));
    await runtime.runPromise(TestClock.adjust(Duration.seconds(3)));
    await runtime.runPromise(service.showSuccessNotification('Command', 'second'));
    await runtime.runPromise(TestClock.adjust(Duration.seconds(2)));
    expect(item.hide).not.toHaveBeenCalled();
    expect(item.text).toBe('$(check) second');
    await callbacks.get('fixture.status.showToast')?.();
    expect(information).toHaveBeenCalledWith('second');
    await runtime.runPromise(TestClock.adjust(Duration.seconds(3)));
    expect(item.hide).toHaveBeenCalledTimes(1);
    expect(item.name).toBe('Fixture status');
    expect(item.command).toBe('fixture.status.showToast');
  } finally {
    await runtime.dispose();
  }
});

it('serializes concurrent status updates so only the latest timer hides the item', async () => {
  setConfig({ global: 'progressStatusBarSuccessStatusBar' });
  const runtime = makeClockRuntime();
  try {
    const service = await runtime.runPromise(NotificationModeService);
    await runtime.runPromise(
      Effect.all(
        [service.showSuccessNotification('Command', 'first'), service.showSuccessNotification('Command', 'second')],
        { concurrency: 2 }
      )
    );
    await runtime.runPromise(TestClock.adjust(Duration.seconds(5)));
    expect(item.hide).toHaveBeenCalledTimes(1);
    expect(item.text).toBe('$(check) second');
  } finally {
    await runtime.dispose();
  }
});

it('keeps a displayed toast action owned when its caller is interrupted during display', async () => {
  const controller = new AbortController();
  const selection = Promise.withResolvers<string | undefined>();
  const ran = Promise.withResolvers<void>();
  information.mockImplementationOnce(() => {
    controller.abort();
    return selection.promise;
  });
  const runtime = makeRuntime();
  try {
    const exit = await runtime.runPromiseExit(
      NotificationModeService.use(service =>
        service.showSuccessNotification('Command', 'done', false, [{ label: 'Open', run: () => ran.resolve() }])
      ),
      { signal: controller.signal }
    );
    expect(Exit.isFailure(exit)).toBe(true);
    selection.resolve('Open');
    await ran.promise;
  } finally {
    await runtime.dispose();
  }
});

it('installs the replacement timer even if its caller is interrupted during status display', async () => {
  const controller = new AbortController();
  setConfig({ global: 'progressStatusBarSuccessStatusBar' });
  item.show.mockImplementationOnce(() => controller.abort());
  const runtime = makeClockRuntime();
  try {
    const exit = await runtime.runPromiseExit(
      NotificationModeService.use(service => service.showSuccessNotification('Command', 'done')),
      { signal: controller.signal }
    );
    expect(Exit.isFailure(exit)).toBe(true);
    await runtime.runPromise(TestClock.adjust(Duration.seconds(5)));
    expect(item.hide).toHaveBeenCalledTimes(1);
  } finally {
    await runtime.dispose();
  }
});

it('closes admission before draining background cleanup and retains the native resources until then', async () => {
  setConfig({ global: 'progressStatusBarSuccessStatusBar' });
  const started = Promise.withResolvers<void>();
  const finalizing = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const clock = clockWithSleep(() =>
    Effect.sync(() => started.resolve()).pipe(
      Effect.andThen(Effect.never),
      Effect.onExit(() =>
        Effect.promise(() => {
          finalizing.resolve();
          return release.promise;
        })
      )
    )
  );
  const runtime = ManagedRuntime.make(
    makeNotificationModeServiceLayer('ext', 'fixture.status', 'Fixture status').pipe(
      Layer.provideMerge(Layer.succeed(Clock.Clock, clock))
    )
  );
  const service = await runtime.runPromise(NotificationModeService);
  await runtime.runPromise(service.showSuccessNotification('Command', 'done'));
  await started.promise;
  const click = callbacks.get('fixture.status.showToast');
  const closing = runtime.dispose();
  try {
    await finalizing.promise;
    expect(item.dispose).not.toHaveBeenCalled();
    expect(disposedCommands).toEqual([]);
    expect(Exit.isFailure(await Effect.runPromiseExit(service.showErrorWithActions('late')))).toBe(true);
    expect(Exit.isFailure(await Effect.runPromiseExit(Effect.promise(() => Promise.resolve(click?.()))))).toBe(true);
    expect(errorToast).not.toHaveBeenCalled();
    expect(information).not.toHaveBeenCalled();
  } finally {
    release.resolve();
    await closing;
  }
  expect(item.dispose).toHaveBeenCalledTimes(1);
  expect(disposedCommands).toEqual(['fixture.status.showToast']);
});

it('retains native cleanup defects while releasing the other resource', async () => {
  const defect = new Error('Command cleanup failed');
  vi.mocked(vscode.commands.registerCommand).mockImplementationOnce(() => ({
    dispose: () => {
      throw defect;
    }
  }));
  const runtime = makeRuntime();
  await runtime.runPromise(NotificationModeService);
  const exit = await Effect.runPromise(runtime.disposeEffect.pipe(Effect.exit));
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isFailure(exit))
    expect(exit.cause.reasons.some(reason => reason._tag === 'Die' && reason.defect === defect)).toBe(true);
  expect(item.dispose).toHaveBeenCalledTimes(1);
});

it('keeps local notification shutdown separate from a caller channel using the same memo map', async () => {
  const memoMap = Layer.makeMemoMapUnsafe();
  const channel = ManagedRuntime.make(makeChannelServiceLayer('Caller'), { memoMap });
  const notifications = ManagedRuntime.make(
    makeNotificationModeServiceLayer('ext', 'fixture.status', 'Fixture status'),
    { memoMap }
  );
  try {
    const service = await channel.runPromise(ChannelService);
    await notifications.runPromise(NotificationModeService);
    await notifications.dispose();
    await channel.runPromise(service.appendToChannel('still active'));
    const output = await channel.runPromise(service.getChannel);
    expect(output.appendLine).toHaveBeenCalledWith('still active');
    expect(output.dispose).not.toHaveBeenCalled();
  } finally {
    await notifications.dispose();
    await channel.dispose();
  }
});

it('releases a created status item when later command registration fails', async () => {
  const defect = new Error('Command registration failed');
  vi.mocked(vscode.commands.registerCommand).mockImplementationOnce(() => {
    throw defect;
  });
  const runtime = makeRuntime();
  try {
    const exit = await runtime.runPromiseExit(NotificationModeService);
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit))
      expect(exit.cause.reasons.some(reason => reason._tag === 'Die' && reason.defect === defect)).toBe(true);
    expect(item.dispose).toHaveBeenCalledTimes(1);
  } finally {
    await runtime.dispose();
  }
});

it('retains both background and native disposal defects', async () => {
  setConfig({ global: 'progressStatusBarSuccessStatusBar' });
  const started = Promise.withResolvers<void>();
  const backgroundDefect = new Error('Timer cleanup failed');
  const nativeDefect = new Error('Status item cleanup failed');
  const clock = clockWithSleep(() =>
    Effect.sync(() => started.resolve()).pipe(
      Effect.andThen(Effect.never),
      Effect.ensuring(Effect.die(backgroundDefect))
    )
  );
  item.dispose.mockImplementationOnce(() => {
    throw nativeDefect;
  });
  const runtime = ManagedRuntime.make(
    makeNotificationModeServiceLayer('ext', 'fixture.status', 'Fixture status').pipe(
      Layer.provideMerge(Layer.succeed(Clock.Clock, clock))
    )
  );
  await runtime.runPromise(NotificationModeService.use(service => service.showSuccessNotification('Command', 'done')));
  await started.promise;
  const exit = await Effect.runPromise(runtime.disposeEffect.pipe(Effect.exit));
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isFailure(exit)) {
    expect(exit.cause.reasons.some(reason => reason._tag === 'Die' && reason.defect === backgroundDefect)).toBe(true);
    expect(exit.cause.reasons.some(reason => reason._tag === 'Die' && reason.defect === nativeDefect)).toBe(true);
  }
  expect(item.dispose).toHaveBeenCalledTimes(1);
  expect(disposedCommands).toEqual(['fixture.status.showToast']);
});
