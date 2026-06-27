/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import { identity } from 'effect/Function';
import * as vscode from 'vscode';
import { orgLoginWebCommand } from '../../../../src/commands/auth/orgLoginWeb';
import { updateConfigAndStateAggregators } from '../../../../src/util/orgUtil';

jest.mock('../../../../src/util/orgUtil', () => ({
  updateConfigAndStateAggregators: jest.fn()
}));

const SUCCESS_STDOUT = JSON.stringify({ status: 0, result: { username: 'me@org.com', orgId: '00Dxx' } });

// withCancellableProgress forks the effect and reports via vscode.window.withProgress; the jest
// vscode mock needs a withProgress that runs the task and returns its result so the fiber resolves.
const stubWithProgress = () => {
  (vscode.window as unknown as { withProgress: jest.Mock }).withProgress = jest.fn(
    (_opts: unknown, task: (progress: unknown, token: { onCancellationRequested: jest.Mock }) => unknown) =>
      task({ report: jest.fn() }, { onCancellationRequested: jest.fn() })
  );
};

const buildServices = (opts: {
  isProject: boolean;
  simpleExec: jest.Mock;
  appendToChannel: jest.Mock;
  showChannel: jest.Mock;
}) => ({
  ProjectService: {
    // gatherAuthParams' QuickPick branch reads sfdcLoginUrl off the project json to offer a "project"
    // org-type; return an empty json (get → undefined) so only the fixed prod/sandbox/custom options show.
    getSfProject: () =>
      opts.isProject
        ? Effect.succeed({ retrieveSfProjectJson: () => Promise.resolve({ get: () => undefined }) })
        : Effect.fail({ _tag: 'FailedToResolveSfProjectError' as const })
  },
  // gatherAuthParams pulls PromptService + (for the prod URL path) ProjectService; the test drives the
  // org-type QuickPick + alias input box through the vscode mock, so PromptService just needs its
  // cancellation helpers. withCancellableProgress is the only operator the command pipes through.
  PromptService: Effect.succeed({
    considerUndefinedAsCancellation: (value: unknown) =>
      value === undefined ? Effect.fail({ _tag: 'UserCancellationError' as const }) : Effect.succeed(value),
    withCancellableProgress: (_title: string) => identity
  }),
  TerminalService: Effect.succeed({ simpleExec: opts.simpleExec }),
  ChannelService: Effect.succeed({
    appendToChannel: (msg: string) =>
      Effect.sync(() => {
        opts.appendToChannel(msg);
      }),
    showChannel: Effect.sync(() => {
      opts.showChannel();
    })
  }),
  UserCancellationError: class {
    public readonly _tag = 'UserCancellationError';
  }
});

const run = (opts: { isProject: boolean; simpleExec: jest.Mock; appendToChannel: jest.Mock; showChannel: jest.Mock }) =>
  Effect.runPromiseExit(
    orgLoginWebCommand().pipe(
      Effect.provideService(ExtensionProviderService, {
        getServicesApi: Effect.succeed({ services: buildServices(opts) })
      } as unknown as ExtensionProviderService)
    ) as Effect.Effect<void, unknown, never>
  );

describe('orgLoginWebCommand', () => {
  let appendToChannel: jest.Mock;
  let showChannel: jest.Mock;
  let showErrorMessage: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (updateConfigAndStateAggregators as jest.Mock).mockResolvedValue(undefined);
    appendToChannel = jest.fn();
    showChannel = jest.fn();
    showErrorMessage = jest.fn();
    stubWithProgress();
    (vscode.window as unknown as { showErrorMessage: jest.Mock }).showErrorMessage = showErrorMessage;
    // gatherAuthParams: select the production org-type QuickPick option, then commit an empty alias
    // (empty string → DEFAULT_ALIAS). The prod option resolves to PRODUCTION_URL with no URL prompt.
    (vscode.window as unknown as { showQuickPick: jest.Mock }).showQuickPick = jest.fn(
      (items: vscode.QuickPickItem[]) => Promise.resolve(items[0])
    );
    (vscode.window as unknown as { showInputBox: jest.Mock }).showInputBox = jest.fn(() => Promise.resolve(''));
  });

  it('runs `sf org login web` with alias + --instance-url + --set-default flags', async () => {
    const simpleExec = jest.fn(() => Effect.succeed(SUCCESS_STDOUT));
    const exit = await run({ isProject: true, simpleExec, appendToChannel, showChannel });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(simpleExec).toHaveBeenCalledWith(
      expect.objectContaining({
        command:
          'sf org login web --alias "vscodeOrg" --instance-url "https://login.salesforce.com" --set-default --json'
      })
    );
  });

  it('appends the output + success message, shows the channel, and refreshes aggregators on success', async () => {
    const simpleExec = jest.fn(() => Effect.succeed(SUCCESS_STDOUT));
    const exit = await run({ isProject: true, simpleExec, appendToChannel, showChannel });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(appendToChannel).toHaveBeenCalledWith(SUCCESS_STDOUT);
    expect(showChannel).toHaveBeenCalled();
    expect(updateConfigAndStateAggregators).toHaveBeenCalledTimes(1);
    // success path must never touch the port-conflict notification
    expect(showErrorMessage).not.toHaveBeenCalled();
  });

  it('does not exec when not in a project (getSfProject precondition fails)', async () => {
    const simpleExec = jest.fn(() => Effect.succeed(SUCCESS_STDOUT));
    const exit = await run({ isProject: false, simpleExec, appendToChannel, showChannel });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('FailedToResolveSfProjectError');
    expect(simpleExec).not.toHaveBeenCalled();
  });

  it('maps a port-conflict TerminalServiceError to showErrorMessage + Show Output (not the generic handler)', async () => {
    const showOutputText = 'Show Output';
    showErrorMessage.mockResolvedValue(showOutputText);
    const simpleExec = jest.fn(() =>
      Effect.fail({
        _tag: 'TerminalServiceError' as const,
        message: 'EADDRINUSE: port 1717 already in use',
        command: 'sf org login web'
      })
    );
    const exit = await run({ isProject: true, simpleExec, appendToChannel, showChannel });

    // the command swallows the conflict (success exit) and renders the notification itself
    expect(Exit.isSuccess(exit)).toBe(true);
    expect(showErrorMessage).toHaveBeenCalledTimes(1);
    expect(showErrorMessage.mock.calls[0][0]).toContain('port 1717');
    expect(showErrorMessage.mock.calls[0][1]).toBe(showOutputText);
    // selecting Show Output reveals the in-layer channel
    expect(showChannel).toHaveBeenCalledTimes(1);
    // conflict branch must not append output or refresh aggregators
    expect(appendToChannel).not.toHaveBeenCalled();
    expect(updateConfigAndStateAggregators).not.toHaveBeenCalled();
  });

  it('does not reveal the channel when the port-conflict notification is dismissed', async () => {
    showErrorMessage.mockResolvedValue(undefined);
    const simpleExec = jest.fn(() =>
      Effect.fail({
        _tag: 'TerminalServiceError' as const,
        message: 'Cannot start the OAuth redirect server on port 1717',
        command: 'sf org login web'
      })
    );
    const exit = await run({ isProject: true, simpleExec, appendToChannel, showChannel });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(showErrorMessage).toHaveBeenCalledTimes(1);
    expect(showChannel).not.toHaveBeenCalled();
  });

  it('rethrows a non-conflict TerminalServiceError to the generic handler', async () => {
    const simpleExec = jest.fn(() =>
      Effect.fail({
        _tag: 'TerminalServiceError' as const,
        message: 'some other CLI failure',
        command: 'sf org login web'
      })
    );
    const exit = await run({ isProject: true, simpleExec, appendToChannel, showChannel });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('TerminalServiceError');
    expect(showErrorMessage).not.toHaveBeenCalled();
  });
});
