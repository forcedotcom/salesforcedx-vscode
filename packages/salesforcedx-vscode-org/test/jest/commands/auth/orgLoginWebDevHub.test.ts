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
import { DEFAULT_ALIAS } from '../../../../src/commands/auth/authParamsGatherer';
import { orgLoginWebDevHubCommand } from '../../../../src/commands/auth/orgLoginWebDevHub';
import { updateConfigAndStateAggregators } from '../../../../src/util/orgUtil';

jest.mock('../../../../src/util/orgUtil', () => ({
  updateConfigAndStateAggregators: jest.fn()
}));

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
  // getSfProject sets the project context and fails when there's no project; the command ignores the
  // returned SfProject, so the success path yields a sentinel.
  ProjectService: {
    getSfProject: () =>
      opts.isProject ? Effect.succeed({}) : Effect.fail({ _tag: 'FailedToResolveSfProjectError' as const })
  },
  TerminalService: Effect.succeed({ simpleExec: opts.simpleExec }),
  // withCancellableProgress is a pipeable operator; the stub is identity so the exec effect runs unchanged.
  PromptService: Effect.succeed({
    withCancellableProgress: () => identity
  }),
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
    orgLoginWebDevHubCommand().pipe(
      Effect.provideService(ExtensionProviderService, {
        getServicesApi: Effect.succeed({ services: buildServices(opts) })
      } as unknown as ExtensionProviderService)
    ) as Effect.Effect<void, unknown, never>
  );

describe('orgLoginWebDevHubCommand', () => {
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs `sf org login web --alias <alias> --set-default-dev-hub` (env injected by simpleExec)', async () => {
    jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce('myHub');
    const simpleExec = jest.fn(() => Effect.succeed(''));

    const exit = await run({ isProject: true, simpleExec, appendToChannel, showChannel });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(simpleExec).toHaveBeenCalledTimes(1);
    const arg = (simpleExec.mock.calls as unknown as [{ command: string; parse: unknown }][])[0][0];
    expect(arg.command).toBe('sf org login web --alias "myHub" --set-default-dev-hub');
    expect(arg.parse).toEqual(expect.any(Function));
  });

  it('defaults the alias to DEFAULT_ALIAS on empty-string input', async () => {
    jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce('');
    const simpleExec = jest.fn(() => Effect.succeed(''));

    const exit = await run({ isProject: true, simpleExec, appendToChannel, showChannel });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(simpleExec).toHaveBeenCalledWith(
      expect.objectContaining({ command: `sf org login web --alias "${DEFAULT_ALIAS}" --set-default-dev-hub` })
    );
  });

  it('cancels (UserCancellationError) and does not exec when the alias prompt is dismissed (undefined)', async () => {
    jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce(undefined);
    const simpleExec = jest.fn(() => Effect.succeed(''));

    const exit = await run({ isProject: true, simpleExec, appendToChannel, showChannel });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('UserCancellationError');
    expect(simpleExec).not.toHaveBeenCalled();
    expect(updateConfigAndStateAggregators).not.toHaveBeenCalled();
  });

  it('fails (getSfProject) and does not exec when not in a project', async () => {
    jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce('myHub');
    const simpleExec = jest.fn(() => Effect.succeed(''));

    const exit = await run({ isProject: false, simpleExec, appendToChannel, showChannel });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('FailedToResolveSfProjectError');
    expect(simpleExec).not.toHaveBeenCalled();
  });

  it('appends output + refreshes aggregators on success', async () => {
    jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce('myHub');
    const simpleExec = jest.fn(() => Effect.succeed('ok'));

    const exit = await run({ isProject: true, simpleExec, appendToChannel, showChannel });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(appendToChannel).toHaveBeenCalledWith('ok');
    expect(showChannel).toHaveBeenCalled();
    expect(updateConfigAndStateAggregators).toHaveBeenCalledTimes(1);
    expect(showErrorMessage).not.toHaveBeenCalled();
  });

  it('does not update the config/state aggregators when the exec fails', async () => {
    jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce('myHub');
    const simpleExec = jest.fn(() =>
      Effect.fail({ _tag: 'TerminalServiceError' as const, message: 'some other CLI failure' })
    );

    const exit = await run({ isProject: true, simpleExec, appendToChannel, showChannel });

    expect(Exit.isFailure(exit)).toBe(true);
    expect(simpleExec).toHaveBeenCalledTimes(1);
    // aggregators run only after a successful exec; the failed fiber short-circuits before reaching them
    expect(updateConfigAndStateAggregators).not.toHaveBeenCalled();
  });

  it('maps a port-conflict TerminalServiceError to showErrorMessage + Show Output (shared executor)', async () => {
    const showOutputText = 'Show Output';
    showErrorMessage.mockResolvedValue(showOutputText);
    jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce('myHub');
    const simpleExec = jest.fn(() =>
      Effect.fail({ _tag: 'TerminalServiceError' as const, message: 'EADDRINUSE: port 1717 already in use' })
    );

    const exit = await run({ isProject: true, simpleExec, appendToChannel, showChannel });

    // the shared executor swallows the conflict (success exit) and renders the notification itself
    expect(Exit.isSuccess(exit)).toBe(true);
    expect(showErrorMessage).toHaveBeenCalledTimes(1);
    expect(showErrorMessage.mock.calls[0][0]).toContain('port 1717');
    expect(updateConfigAndStateAggregators).not.toHaveBeenCalled();
  });
});
