/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CliCommandExecutor, ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { OrgCreateExecutor } from '../../../src/commands/orgCreate';

// Minimal rxjs-Subject stand-in (avoids a direct rxjs dep in this package): the executor only
// uses .subscribe()/.next(). The CommandExecution Observables are mocked away via streamCommandOutput.
type FakeSubject<T> = { subscribe: (cb: (value: T) => void) => void; next: (value: T) => void };
const fakeSubject = <T>(): FakeSubject<T> => {
  const cbs: Array<(value: T) => void> = [];
  return { subscribe: cb => void cbs.push(cb), next: value => cbs.forEach(cb => cb(value)) };
};

// subjects the test drives to simulate the CLI's stdout stream and process exit.
let stdoutSubject: FakeSubject<string>;
let stderrSubject: FakeSubject<string>;
let processExitSubject: FakeSubject<number | undefined>;
const executeMock = jest.fn();

jest.mock('@salesforce/salesforcedx-utils-vscode', () => ({
  ...jest.requireActual('@salesforce/salesforcedx-utils-vscode'),
  CliCommandExecutor: jest.fn(() => ({ execute: executeMock })),
  notificationService: { reportCommandExecutionStatus: jest.fn() },
  ProgressNotification: { show: jest.fn() },
  TelemetryService: { getInstance: () => ({ sendCommandEvent: jest.fn(), sendException: jest.fn() }) }
}));

const appendLine = jest.fn<void, [string]>();
jest.mock('../../../src/channels', () => ({
  channelService: {
    appendLine: (text: string) => appendLine(text),
    streamCommandOutput: jest.fn(),
    streamCommandStartStop: jest.fn()
  }
}));

const mockUpdateConfigAndStateAggregators = jest.fn<Promise<void>, []>();
jest.mock('../../../src/util/orgUtil', () => ({
  updateConfigAndStateAggregators: () => mockUpdateConfigAndStateAggregators()
}));

jest.mock('../../../src/telemetry', () => ({
  telemetryService: { sendException: jest.fn() }
}));

// Global.SF_DIR derives from os.homedir(), undefined under the jest env mock; pin it so the
// failure-body dump resolves a real path.
jest.mock('@salesforce/core/global', () => ({ Global: { SF_DIR: '/tmp/sf-test' } }));

const flush = () => new Promise<void>(resolve => setImmediate(resolve));

const response: ContinueResponse<{ alias: string; expirationDays: string; file: string }> = {
  type: 'CONTINUE',
  data: { alias: 'a', expirationDays: '1', file: 'config/project-scratch-def.json' }
};

// Capture the CancellationTokenSource the executor constructs so the test can assert cancel().
let lastCancelSpy: jest.Mock;
const RealCancellationTokenSource = vscode.CancellationTokenSource;

describe('OrgCreateExecutor.execute', () => {
  beforeEach(() => {
    // keep setImmediate real so `flush()` drains the async processExitSubject subscriber microtasks
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
    stdoutSubject = fakeSubject<string>();
    stderrSubject = fakeSubject<string>();
    processExitSubject = fakeSubject<number | undefined>();
    appendLine.mockClear();
    mockUpdateConfigAndStateAggregators.mockClear();
    mockUpdateConfigAndStateAggregators.mockResolvedValue(undefined);
    lastCancelSpy = jest.fn();
    // resetMocks wipes implementations between tests; restore the executor + its execute() each time
    (CliCommandExecutor as unknown as jest.Mock).mockImplementation(() => ({ execute: executeMock }));
    executeMock.mockReturnValue({
      command: { logName: 'org_create_default_scratch_org', toString: () => 'sf', toCommand: () => 'sf' },
      stdoutSubject,
      stderrSubject,
      processExitSubject,
      processErrorSubject: fakeSubject<Error | undefined>()
    });
    // @ts-expect-error overriding the mutable vscode mock export to capture cancel()
    vscode.CancellationTokenSource = class {
      private readonly inner = new RealCancellationTokenSource();
      public token = this.inner.token;
      public cancel = () => {
        lastCancelSpy();
        this.inner.cancel();
      };
      public dispose = () => this.inner.dispose();
    };
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    // @ts-expect-error restore the original mock export
    vscode.CancellationTokenSource = RealCancellationTokenSource;
  });

  it('(a) success exit runs the success branch and clears the 3min timer', async () => {
    new OrgCreateExecutor().execute(response);
    stdoutSubject.next(JSON.stringify({ status: 0, result: { orgId: '00D', username: 'u' } }));
    processExitSubject.next(0);
    await flush();

    expect(mockUpdateConfigAndStateAggregators).toHaveBeenCalledTimes(1);
    // timer cleared: advancing past 180s must not late-cancel a since-completed command
    jest.advanceTimersByTime(180_000);
    expect(lastCancelSpy).not.toHaveBeenCalled();
  });

  it('(b) cancels at 180s when the CLI never exits, and a later exit does not throw', async () => {
    new OrgCreateExecutor().execute(response);
    expect(lastCancelSpy).not.toHaveBeenCalled();
    jest.advanceTimersByTime(180_000);
    expect(lastCancelSpy).toHaveBeenCalledTimes(1);

    const body = JSON.stringify({ status: 1, name: 'E', message: 'boom' });
    stdoutSubject.next(body);
    expect(() => processExitSubject.next(1)).not.toThrow();
    await flush();
    expect(appendLine).toHaveBeenCalledWith('boom');
  });

  it('(c) appends the parsed error message to the channel on the failure branch', async () => {
    new OrgCreateExecutor().execute(response);
    const body = JSON.stringify({ status: 1, name: 'E', message: 'boom', exitCode: 1 });
    stdoutSubject.next(body);
    processExitSubject.next(1);
    await flush();

    expect(appendLine).toHaveBeenCalledWith('boom');
    expect(mockUpdateConfigAndStateAggregators).not.toHaveBeenCalled();
  });

  it('(d) dumps the raw CLI --json body to the spans dir on the failure branch', async () => {
    const createDirectory = jest.spyOn(vscode.workspace.fs, 'createDirectory').mockResolvedValue();
    const writeFile = jest.spyOn(vscode.workspace.fs, 'writeFile').mockResolvedValue();
    try {
      new OrgCreateExecutor().execute(response);
      const body = JSON.stringify({ status: 1, name: 'E', message: 'boom', exitCode: 1 });
      stdoutSubject.next(body);
      processExitSubject.next(1);
      await flush();
      await flush();

      expect(createDirectory).toHaveBeenCalledTimes(1);
      const [uri, content] = writeFile.mock.calls[0];
      expect(uri.fsPath).toContain('vscode-spans');
      expect(uri.fsPath).toMatch(/org-create-failure-.*\.txt$/);
      const dumped = new TextDecoder().decode(content);
      expect(dumped).toContain('exitCode: 1');
      expect(dumped).toContain(body);
    } finally {
      createDirectory.mockRestore();
      writeFile.mockRestore();
    }
  });

  it('(e) dumps stderr and exit code when the CLI writes nothing to stdout', async () => {
    const createDirectory = jest.spyOn(vscode.workspace.fs, 'createDirectory').mockResolvedValue();
    const writeFile = jest.spyOn(vscode.workspace.fs, 'writeFile').mockResolvedValue();
    try {
      new OrgCreateExecutor().execute(response);
      // empty stdout (the real failure mode): error surfaces on stderr instead
      stderrSubject.next('ERROR running org:create:scratch: The signup request failed');
      processExitSubject.next(1);
      await flush();
      await flush();

      const dumped = new TextDecoder().decode(writeFile.mock.calls[0][1]);
      expect(dumped).toContain('exitCode: 1');
      expect(dumped).toContain('The signup request failed');
    } finally {
      createDirectory.mockRestore();
      writeFile.mockRestore();
    }
  });
});
