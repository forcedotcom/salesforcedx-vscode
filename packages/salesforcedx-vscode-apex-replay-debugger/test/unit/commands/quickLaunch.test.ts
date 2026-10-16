/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import type { Mock as VitestMock } from 'vitest';
import * as vscode from 'vscode';

// quickLaunch imports checkpointService, which requires the Apex extension at module load
vi.mock('../../../src/apexExtension', () => ({ salesforceApexExtension: { isActive: true, activate: vi.fn() } }));
vi.mock('../../../src/commands/launchFromLogFile', () => ({ launchFromLogFile: vi.fn() }));
vi.mock('vscode', async () => ({
  ...(await vi.importActual<typeof vscode>('vscode')),
  debug: {}
}));

import { launchFromLogFile } from '../../../src/commands/launchFromLogFile';
import { replayInOrder, showDebugTestOutcome, toDebugTargets } from '../../../src/commands/quickLaunch';

const showSuccessNotification = vi.fn((..._a: unknown[]) => Effect.void);
const notificationMode = { showSuccessNotification } as unknown as Parameters<typeof showDebugTestOutcome>[0];

describe('showDebugTestOutcome', () => {
  beforeEach(() => {
    // Restore the notification implementation after the shared mock reset.
    showSuccessNotification.mockImplementation(() => Effect.void);
  });

  it('shows the success notification when no test failed', async () => {
    await Effect.runPromise(showDebugTestOutcome(notificationMode, 0));
    expect(showSuccessNotification).toHaveBeenCalledWith(
      'Debug Apex Test Class',
      'Debug Test(s) successfully ran',
      false
    );
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
  });

  it('shows a failing-tests error instead of success when any test failed', async () => {
    await Effect.runPromise(showDebugTestOutcome(notificationMode, 2));
    expect(showSuccessNotification).not.toHaveBeenCalled();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Debug Test(s) completed with 2 failing test(s)');
  });
});

/** Minimal event: `on` subscribes, `fire` notifies current subscribers. */
const makeEvent = <T>() => {
  const listeners = new Set<(value: T) => void>();
  return {
    on: (listener: (value: T) => void) => {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
    fire: (value: T) => [...listeners].forEach(listener => listener(value))
  };
};

const flush = () => new Promise(resolve => setImmediate(resolve));

describe('replayInOrder', () => {
  const launch = launchFromLogFile as VitestMock;
  const logs = [
    { label: 'A.testA', logPath: '/logs/a.log' },
    { label: 'B.testB', logPath: '/logs/b.log' }
  ];
  let terminated: ReturnType<typeof makeEvent<{ type: string }>>;
  let activeChanged: ReturnType<typeof makeEvent<unknown>>;
  let cancelled: ReturnType<typeof makeEvent<void>>;
  let token: { isCancellationRequested: boolean; onCancellationRequested: (listener: () => void) => unknown };
  let debug: { activeDebugSession: unknown };

  beforeEach(() => {
    terminated = makeEvent();
    activeChanged = makeEvent();
    cancelled = makeEvent();
    token = { isCancellationRequested: false, onCancellationRequested: cancelled.on };
    debug = Object.assign(vscode.debug, {
      activeDebugSession: undefined,
      onDidTerminateDebugSession: terminated.on,
      onDidChangeActiveDebugSession: activeChanged.on
    });
    (vscode.window.withProgress as VitestMock).mockImplementation(
      (_options: unknown, task: (progress: unknown, token: unknown) => Promise<void>) =>
        task({ report: vi.fn() }, token)
    );
    launch.mockReturnValue(Effect.succeed(true));
  });

  it('waits for each replay session to end before launching the next', async () => {
    const done = Effect.runPromise(replayInOrder(logs));
    await flush();
    expect(launch.mock.calls).toEqual([['/logs/a.log', false]]);

    terminated.fire({ type: 'apex-replay' });
    await flush();
    expect(launch.mock.calls).toEqual([
      ['/logs/a.log', false],
      ['/logs/b.log', false]
    ]);

    terminated.fire({ type: 'apex-replay' });
    await done;
    expect(launch).toHaveBeenCalledTimes(2);
  });

  it('ignores other debuggers ending', async () => {
    const done = Effect.runPromise(replayInOrder(logs));
    await flush();
    terminated.fire({ type: 'node' });
    await flush();
    expect(launch).toHaveBeenCalledTimes(1);

    terminated.fire({ type: 'apex-replay' });
    await flush();
    terminated.fire({ type: 'apex-replay' });
    await done;
  });

  it('waits for VS Code to clear the active session after a replay ends', async () => {
    const done = Effect.runPromise(replayInOrder(logs));
    await flush();
    // The terminate event can fire while VS Code still reports the finished session as active
    debug.activeDebugSession = { type: 'apex-replay' };
    terminated.fire({ type: 'apex-replay' });
    await flush();
    expect(launch).toHaveBeenCalledTimes(1);

    debug.activeDebugSession = undefined;
    activeChanged.fire(undefined);
    await flush();
    expect(launch).toHaveBeenLastCalledWith('/logs/b.log', false);

    terminated.fire({ type: 'apex-replay' });
    await done;
  });

  it('stops before the next log when cancelled', async () => {
    const done = Effect.runPromise(replayInOrder(logs));
    await flush();
    token.isCancellationRequested = true;
    cancelled.fire();
    await done;
    expect(launch).toHaveBeenCalledTimes(1);
  });

  it('shows an error when launching a replay fails', async () => {
    launch.mockReturnValue(Effect.die(new Error('launch boom')));
    await Effect.runPromise(replayInOrder(logs));
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('launch boom'));
  });
});

describe('toDebugTargets', () => {
  it('runs the selected methods of a class together, one target per class', () => {
    expect(toDebugTargets([], ['A.test1', 'B.test1', 'A.test2'])).toEqual([
      { className: 'A', methodNames: ['test1', 'test2'] },
      { className: 'B', methodNames: ['test1'] }
    ]);
  });

  it('keeps namespaced classes apart from same-named local classes', () => {
    expect(toDebugTargets([], ['ns.A.test1', 'A.test1'])).toEqual([
      { className: 'ns.A', methodNames: ['test1'] },
      { className: 'A', methodNames: ['test1'] }
    ]);
  });

  it('runs a class selected whole once, dropping its separately selected methods', () => {
    expect(toDebugTargets(['A'], ['A.test1', 'B.test1'])).toEqual([
      { className: 'A' },
      { className: 'B', methodNames: ['test1'] }
    ]);
  });
});
