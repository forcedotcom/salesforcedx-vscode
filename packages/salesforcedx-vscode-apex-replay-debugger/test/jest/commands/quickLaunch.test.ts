/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';

// quickLaunch imports checkpointService, which requires the Apex extension at module load
jest.mock('../../../src/apexExtension', () => ({ salesforceApexExtension: { isActive: true, activate: jest.fn() } }));
jest.mock('../../../src/commands/launchFromLogFile', () => ({ launchFromLogFile: jest.fn() }));

import { launchFromLogFile } from '../../../src/commands/launchFromLogFile';
import { replayInOrder, showDebugTestOutcome } from '../../../src/commands/quickLaunch';

const showSuccessNotification = jest.fn((..._a: unknown[]) => Effect.void);
const notificationMode = { showSuccessNotification } as unknown as Parameters<typeof showDebugTestOutcome>[0];

describe('showDebugTestOutcome', () => {
  beforeEach(() => {
    // resetMocks (jest.base.config) clears implementations before each test
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
  const launch = launchFromLogFile as jest.Mock;
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
    debug = { activeDebugSession: undefined };
    Object.assign(vscode, {
      debug: Object.assign(debug, {
        onDidTerminateDebugSession: terminated.on,
        onDidChangeActiveDebugSession: activeChanged.on
      })
    });
    (vscode.window.withProgress as jest.Mock).mockImplementation(
      (_options: unknown, task: (progress: unknown, token: unknown) => Promise<void>) =>
        task({ report: jest.fn() }, token)
    );
    launch.mockResolvedValue(true);
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
    launch.mockRejectedValue(new Error('launch boom'));
    await Effect.runPromise(replayInOrder(logs));
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('launch boom'));
  });
});
