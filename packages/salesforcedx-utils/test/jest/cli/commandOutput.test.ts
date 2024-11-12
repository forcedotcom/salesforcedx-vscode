/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CommandOutput } from '../../../src';

describe('CommandOutput Unit Tests.', () => {
  const goodOutput = 'its gooooooood';
  const badOutput = 'all baaaaaaad';
  const successCode = '0';
  const failCode = '1';

  let commandOutput: CommandOutput;
  let result: Promise<string>;

  // It's a pain to unit test Observables.  Open to exploring other options.

  let fakeExecution: any;
  beforeEach(() => {
    fakeExecution = {
      stdoutSubject: {
        subscribe: jest.fn()
      },
      stderrSubject: {
        subscribe: jest.fn()
      },
      processExitSubject: {
        subscribe: jest.fn()
      },
      command: {
        command: 'sf'
      }
    };
    commandOutput = new CommandOutput();
    result = commandOutput.getCmdResult(fakeExecution);
  });
  it('Should handle successful process exit.', async () => {
    expect(fakeExecution.stdoutSubject.subscribe).toHaveBeenCalled();
    expect(fakeExecution.stderrSubject.subscribe).toHaveBeenCalled();
    expect(fakeExecution.processExitSubject.subscribe).toHaveBeenCalled();
    const exitCallback = fakeExecution.processExitSubject.subscribe.mock.calls[0][0];
    // Call the exit callback with a 0 response to indicate success
    exitCallback(successCode);
    result.then(outValue => {
      expect(outValue).toEqual('');
    });
  });

  it('Should have data from stdout on success.', async () => {
    const stdoutCallback = fakeExecution.stdoutSubject.subscribe.mock.calls[0][0];
    stdoutCallback(goodOutput);
    const stderrCallback = fakeExecution.stderrSubject.subscribe.mock.calls[0][0];
    stderrCallback(badOutput);
    const exitCallback = fakeExecution.processExitSubject.subscribe.mock.calls[0][0];
    // Call the exit callback with a 0 response to indicate success
    exitCallback(successCode);
    result.then(outValue => {
      expect(outValue).toEqual(goodOutput);
    });
  });

  it('Should process multiple calls to stdout.', async () => {
    const stdoutCallback = fakeExecution.stdoutSubject.subscribe.mock.calls[0][0];
    stdoutCallback(goodOutput);
    stdoutCallback(goodOutput);
    stdoutCallback(goodOutput);
    const exitCallback = fakeExecution.processExitSubject.subscribe.mock.calls[0][0];
    // Call the exit callback with a 0 response to indicate success
    exitCallback(successCode);
    result.then(outValue => {
      expect(outValue).toEqual(goodOutput + goodOutput + goodOutput);
    });
  });

  it('Should have data from stderr on failure for not command sf.', async () => {
    fakeExecution.command.command = 'notsf';
    const stdoutCallback = fakeExecution.stdoutSubject.subscribe.mock.calls[0][0];
    stdoutCallback(goodOutput);
    const stderrCallback = fakeExecution.stderrSubject.subscribe.mock.calls[0][0];
    stderrCallback(badOutput);
    const exitCallback = fakeExecution.processExitSubject.subscribe.mock.calls[0][0];
    // Call the exit callback with a 1 response to indicate failure
    exitCallback(failCode);
    result.catch(outValue => {
      expect(outValue).toEqual(badOutput);
    });
  });

  it('Should have data from stdout on failure if there is no stderr when command not sf.', async () => {
    fakeExecution.command.command = 'notsf';
    const stdoutCallback = fakeExecution.stdoutSubject.subscribe.mock.calls[0][0];
    stdoutCallback(goodOutput);
    const exitCallback = fakeExecution.processExitSubject.subscribe.mock.calls[0][0];
    // Call the exit callback with a 1 response to indicate failure
    exitCallback(failCode);
    result.catch(outValue => {
      expect(outValue).toEqual(goodOutput);
    });
  });
  it('Should have data from stdout on failure for sf command.', async () => {
    const stdoutCallback = fakeExecution.stdoutSubject.subscribe.mock.calls[0][0];
    stdoutCallback(badOutput);
    const stderrCallback = fakeExecution.stderrSubject.subscribe.mock.calls[0][0];
    stderrCallback(goodOutput);
    const exitCallback = fakeExecution.processExitSubject.subscribe.mock.calls[0][0];
    // Call the exit callback with a 1 response to indicate failure
    exitCallback(failCode);
    result.catch(outValue => {
      expect(outValue).toEqual(badOutput);
    });
  });

  it('Should have data from stderr on failure if there is no stdout when sf command.', async () => {
    const stderrCallback = fakeExecution.stderrSubject.subscribe.mock.calls[0][0];
    stderrCallback(badOutput);
    const exitCallback = fakeExecution.processExitSubject.subscribe.mock.calls[0][0];
    // Call the exit callback with a 1 response to indicate failure
    exitCallback(failCode);
    result.catch(outValue => {
      expect(outValue).toEqual(badOutput);
    });
  });
});
