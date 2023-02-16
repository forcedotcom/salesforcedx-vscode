import { CancellationToken, CliCommandExecution, Command } from '../../../src';
import {
  CANCELLATION_INTERVAL,
  KILL_CODE,
  NO_PID_ERROR,
  NO_STDERR_ERROR,
  NO_STDOUT_ERROR
} from '../../../src/cli/cliCommandExecution';
import { Observable } from 'rxjs/Observable';
import * as kill from 'tree-kill';
jest.mock('tree-kill');

const treeKillMocked = jest.mocked(kill);

describe('CliCommandExecution Unit Tests.', () => {
  const testCommand: Command = {
    command: 'do a thing',
    args: ['arg1', 'arg2'],
    toCommand: jest.fn()
  };
  let testChildProcess: any;
  let testCancelationToken: CancellationToken;
  let fromEventSpy: jest.SpyInstance;
  let intervalSpy: jest.SpyInstance;
  let subscribeSpy: jest.SpyInstance;
  let unsubscribeSpy: jest.SpyInstance;

  beforeEach(() => {
    testChildProcess = {
      pid: 1234,
      stdout: jest.fn(),
      stderr: jest.fn()
    };
    testCancelationToken = {
      isCancellationRequested: false
    };
    unsubscribeSpy = jest.fn();
    subscribeSpy = jest.fn().mockReturnValue({
      unsubscribe: unsubscribeSpy
    });
    fromEventSpy = jest.spyOn(Observable, 'fromEvent').mockReturnValue({
      subscribe: subscribeSpy
    } as any);
    intervalSpy = jest.spyOn(Observable, 'interval').mockReturnValue({
      subscribe: subscribeSpy
    } as any);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('Should be able to create an instance.', () => {
    const cliCommandExecution = new CliCommandExecution(
      testCommand,
      testChildProcess
    );
    expect(cliCommandExecution).toBeInstanceOf(CliCommandExecution);
    expect(fromEventSpy).toHaveBeenCalledTimes(4);
    expect(fromEventSpy.mock.calls[0]).toEqual([testChildProcess, 'exit']);
    expect(fromEventSpy.mock.calls[1]).toEqual([testChildProcess, 'error']);
    expect(fromEventSpy.mock.calls[2]).toEqual([
      testChildProcess.stdout,
      'data'
    ]);
    expect(fromEventSpy.mock.calls[3]).toEqual([
      testChildProcess.stderr,
      'data'
    ]);

    expect(subscribeSpy).toHaveBeenCalledTimes(2);
  });

  it('Should be able to create an instance with cancelation token.', () => {
    const cliCommandExecution = new CliCommandExecution(
      testCommand,
      testChildProcess,
      testCancelationToken
    );
    expect(cliCommandExecution).toBeInstanceOf(CliCommandExecution);
    expect(subscribeSpy).toHaveBeenCalledTimes(3);
    expect(intervalSpy).toHaveBeenCalledWith(CANCELLATION_INTERVAL);
  });

  describe('Subscribe handlers.', () => {
    it('Should call timer unsubscribe on exit.', () => {
      const cliCommandExecution = new CliCommandExecution(
        testCommand,
        testChildProcess,
        testCancelationToken
      );
      expect(cliCommandExecution).toBeDefined();
      const exitSubscribeHandler = subscribeSpy.mock.calls[0][0];
      exitSubscribeHandler();
      expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    });

    it('Should call timer unsubscribe on error.', () => {
      const cliCommandExecution = new CliCommandExecution(
        testCommand,
        testChildProcess,
        testCancelationToken
      );
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
        new CliCommandExecution(
          testCommand,
          testChildProcess,
          testCancelationToken
        );
      }).toThrowError(NO_PID_ERROR);
    });
    it('Should fail to create if child has no stdout.', () => {
      testChildProcess.stdout = undefined;
      expect(() => {
        new CliCommandExecution(
          testCommand,
          testChildProcess,
          testCancelationToken
        );
      }).toThrowError(NO_STDOUT_ERROR);
    });
    it('Should fail to create if child has no stderr.', () => {
      testChildProcess.stderr = undefined;
      expect(() => {
        new CliCommandExecution(
          testCommand,
          testChildProcess,
          testCancelationToken
        );
      }).toThrowError(NO_STDERR_ERROR);
    });
  });

  describe('kill on timeout.', () => {
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
      logSpy = jest.spyOn(console, 'log');
    });
    it('Should be able to successfully kill child process.', async () => {
      testCancelationToken.isCancellationRequested = true;
      const cliCommandExecution = new CliCommandExecution(
        testCommand,
        testChildProcess,
        testCancelationToken
      );
      expect(cliCommandExecution).toBeInstanceOf(CliCommandExecution);
      expect(subscribeSpy).toHaveBeenCalledTimes(3);
      const timoutHandler = subscribeSpy.mock.calls[2][0];
      const timeoutPromise = timoutHandler();
      expect(treeKillMocked).toHaveBeenCalledTimes(1);
      expect(treeKillMocked.mock.calls[0][0]).toEqual(testChildProcess.pid);
      expect(treeKillMocked.mock.calls[0][1]).toEqual(KILL_CODE);
      // call the passed kill handler
      const killCallback = treeKillMocked.mock.calls[0][2];
      if (killCallback) {
        killCallback();
      } else {
        fail('Should have had a kill callback function.');
      }
      timeoutPromise.then(() => {
        expect(logSpy).not.toHaveBeenCalled();
      });
    });

    it('Should log if fails to kill child process.', () => {
      const killError = new Error('Failed to kill');
      testCancelationToken.isCancellationRequested = true;
      const cliCommandExecution = new CliCommandExecution(
        testCommand,
        testChildProcess,
        testCancelationToken
      );
      expect(cliCommandExecution).toBeInstanceOf(CliCommandExecution);
      expect(subscribeSpy).toHaveBeenCalledTimes(3);
      const timoutHandler = subscribeSpy.mock.calls[2][0];
      const timeoutPromise = timoutHandler();
      expect(treeKillMocked).toHaveBeenCalledTimes(1);
      expect(treeKillMocked.mock.calls[0][0]).toEqual(testChildProcess.pid);
      expect(treeKillMocked.mock.calls[0][1]).toEqual(KILL_CODE);
      // call the passed kill handler
      const killCallback = treeKillMocked.mock.calls[0][2];
      if (killCallback) {
        killCallback(killError);
      } else {
        fail('Should have had a kill callback function.');
      }
      timeoutPromise.then(() => {
        expect(logSpy).toHaveBeenCalledWith(killError);
      });
    });
  });
});
