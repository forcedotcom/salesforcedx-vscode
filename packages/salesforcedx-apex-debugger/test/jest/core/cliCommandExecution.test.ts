/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { MockInstance as VitestMockInstance } from 'vitest';
import type { Command, CancellationToken } from '@salesforce/salesforcedx-utils';
import * as rxjs from 'rxjs';
import { treeKill } from '../../../src/core/crossSpawnAndTreeKill';
import {
  CANCELLATION_INTERVAL,
  KILL_CODE,
  NO_PID_ERROR,
  NO_STDERR_ERROR,
  NO_STDOUT_ERROR,
  CliCommandExecution
} from '../../../src/core/cliCommandExecution';

vi.mock('../../../src/core/crossSpawnAndTreeKill');

const treeKillMocked = vi.mocked(treeKill);

describe('CliCommandExecution Unit Tests.', () => {
  const testCommand: Command = {
    command: 'do a thing',
    args: ['arg1', 'arg2'],
    toCommand: vi.fn()
  };
  let testChildProcess: any;
  let testCancelationToken: CancellationToken;
  let fromEventSpy: VitestMockInstance;
  let intervalSpy: VitestMockInstance;
  let subscribeSpy: VitestMockInstance;
  let unsubscribeSpy: VitestMockInstance;

  beforeEach(() => {
    testChildProcess = {
      pid: 1234,
      stdout: vi.fn(),
      stderr: vi.fn()
    };
    testCancelationToken = {
      isCancellationRequested: false
    };
    unsubscribeSpy = vi.fn();
    subscribeSpy = vi.fn().mockReturnValue({
      unsubscribe: unsubscribeSpy
    });
    fromEventSpy = vi.spyOn(rxjs, 'fromEvent').mockReturnValue({
      subscribe: subscribeSpy
    } as any);
    intervalSpy = vi.spyOn(rxjs, 'interval').mockReturnValue({
      subscribe: subscribeSpy
    } as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('Should be able to create an instance.', () => {
    const cliCommandExecution = new CliCommandExecution(testCommand, testChildProcess);
    expect(cliCommandExecution).toBeInstanceOf(CliCommandExecution);
    expect(fromEventSpy).toHaveBeenCalledTimes(4);
    expect(fromEventSpy.mock.calls[0]).toEqual([testChildProcess, 'exit']);
    expect(fromEventSpy.mock.calls[1]).toEqual([testChildProcess, 'error']);
    expect(fromEventSpy.mock.calls[2]).toEqual([testChildProcess.stdout, 'data']);
    expect(fromEventSpy.mock.calls[3]).toEqual([testChildProcess.stderr, 'data']);

    expect(subscribeSpy).toHaveBeenCalledTimes(2);
  });

  it('Should be able to create an instance with cancelation token.', () => {
    const cliCommandExecution = new CliCommandExecution(testCommand, testChildProcess, testCancelationToken);
    expect(cliCommandExecution).toBeInstanceOf(CliCommandExecution);
    expect(subscribeSpy).toHaveBeenCalledTimes(3);
    expect(intervalSpy).toHaveBeenCalledWith(CANCELLATION_INTERVAL);
  });

  describe('Subscribe handlers.', () => {
    it('Should call timer unsubscribe on exit.', () => {
      const cliCommandExecution = new CliCommandExecution(testCommand, testChildProcess, testCancelationToken);
      expect(cliCommandExecution).toBeDefined();
      const exitSubscribeHandler = subscribeSpy.mock.calls[0][0];
      exitSubscribeHandler();
      expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    });

    it('Should call timer unsubscribe on error.', () => {
      const cliCommandExecution = new CliCommandExecution(testCommand, testChildProcess, testCancelationToken);
      expect(cliCommandExecution).toBeDefined();
      const exitSubscribeHandler = subscribeSpy.mock.calls[1][0];
      exitSubscribeHandler();
      expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Verify child process.', () => {
    it('Should fail to create if child has no pid.', () => {
      testChildProcess.pid = undefined;
      expect(() => {
        new CliCommandExecution(testCommand, testChildProcess, testCancelationToken);
      }).toThrow(NO_PID_ERROR);
    });
    it('Should fail to create if child has no stdout.', () => {
      testChildProcess.stdout = undefined;
      expect(() => {
        new CliCommandExecution(testCommand, testChildProcess, testCancelationToken);
      }).toThrow(NO_STDOUT_ERROR);
    });
    it('Should fail to create if child has no stderr.', () => {
      testChildProcess.stderr = undefined;
      expect(() => {
        new CliCommandExecution(testCommand, testChildProcess, testCancelationToken);
      }).toThrow(NO_STDERR_ERROR);
    });
  });

  describe('kill on timeout.', () => {
    let logSpy: VitestMockInstance;

    beforeEach(() => {
      logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });
    it('Should be able to successfully kill child process.', async () => {
      testCancelationToken.isCancellationRequested = true;
      const cliCommandExecution = new CliCommandExecution(testCommand, testChildProcess, testCancelationToken);
      expect(cliCommandExecution).toBeInstanceOf(CliCommandExecution);
      expect(subscribeSpy).toHaveBeenCalledTimes(3);
      const timoutHandler = subscribeSpy.mock.calls[2][0];
      const timeoutPromise = timoutHandler();
      expect(treeKillMocked).toHaveBeenCalledTimes(1);
      expect(treeKillMocked.mock.calls[0][0]).toEqual(testChildProcess.pid);
      expect(treeKillMocked.mock.calls[0][1]).toEqual(KILL_CODE);
      // call the passed kill handler
      const killCallback = treeKillMocked.mock.calls[0][2];
      expect(killCallback).toBeDefined();
      killCallback?.();
      await timeoutPromise;
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('Should log if fails to kill child process.', async () => {
      const killError = new Error('Failed to kill');
      testCancelationToken.isCancellationRequested = true;
      const cliCommandExecution = new CliCommandExecution(testCommand, testChildProcess, testCancelationToken);
      expect(cliCommandExecution).toBeInstanceOf(CliCommandExecution);
      expect(subscribeSpy).toHaveBeenCalledTimes(3);
      const timoutHandler = subscribeSpy.mock.calls[2][0];
      const timeoutPromise = timoutHandler();
      expect(treeKillMocked).toHaveBeenCalledTimes(1);
      expect(treeKillMocked.mock.calls[0][0]).toEqual(testChildProcess.pid);
      expect(treeKillMocked.mock.calls[0][1]).toEqual(KILL_CODE);
      // call the passed kill handler
      const killCallback = treeKillMocked.mock.calls[0][2];
      expect(killCallback).toBeDefined();
      killCallback?.(killError);
      await timeoutPromise;
      expect(logSpy).toHaveBeenCalledWith(killError);
    });
  });
});
