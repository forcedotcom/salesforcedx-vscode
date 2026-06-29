/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as vscode from 'vscode';
import { DEFAULT_ALIAS } from '../../../../src/commands/auth/authParamsGatherer';
import { orgLoginWebDevHubCommand } from '../../../../src/commands/auth/orgLoginWebDevHub';
import * as orgUtil from '../../../../src/util/orgUtil';
import * as verificationCode from '../../../../src/util/verificationCode';
import { UserCancellationError } from '../../testHelpers/promptServiceStub';

const buildServices = (opts: { isProject: boolean; simpleExec: jest.Mock }) => ({
  // getSfProject sets the project context and fails when there's no project; the command ignores the
  // returned SfProject, so the success path yields a sentinel.
  ProjectService: {
    getSfProject: () =>
      opts.isProject ? Effect.succeed({}) : Effect.fail({ _tag: 'FailedToResolveSfProjectError' as const })
  },
  TerminalService: Effect.succeed({ simpleExec: opts.simpleExec }),
  // withCancellableProgress is a pipeable operator; the stub is identity so the exec effect runs unchanged.
  PromptService: Effect.succeed({
    withCancellableProgress:
      () =>
      <A, E, R>(self: Effect.Effect<A, E, R>) =>
        self
  }),
  UserCancellationError
});

const run = (opts: { isProject: boolean; simpleExec: jest.Mock }) =>
  Effect.runPromiseExit(
    orgLoginWebDevHubCommand().pipe(
      Effect.provideService(ExtensionProviderService, {
        getServicesApi: Effect.succeed({ services: buildServices(opts) })
      } as unknown as ExtensionProviderService)
    ) as Effect.Effect<void, unknown, never>
  );

describe('orgLoginWebDevHubCommand', () => {
  let updateAggregators: jest.SpyInstance;
  let showVerification: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    updateAggregators = jest.spyOn(orgUtil, 'updateConfigAndStateAggregators').mockResolvedValue(undefined);
    showVerification = jest.spyOn(verificationCode, 'showVerificationCodeIfNeeded').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs `sf org login web --alias <alias> --set-default-dev-hub` (env injected by simpleExec)', async () => {
    jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce('myHub');
    const simpleExec = jest.fn(() => Effect.succeed(''));

    const exit = await run({ isProject: true, simpleExec });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(simpleExec).toHaveBeenCalledTimes(1);
    const arg = simpleExec.mock.calls[0][0] as { command: string; parse: unknown };
    expect(arg.command).toBe("sf org login web --alias 'myHub' --set-default-dev-hub");
    expect(arg.parse).toEqual(expect.any(Function));
  });

  it('defaults the alias to DEFAULT_ALIAS on empty-string input', async () => {
    jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce('');
    const simpleExec = jest.fn(() => Effect.succeed(''));

    const exit = await run({ isProject: true, simpleExec });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(simpleExec).toHaveBeenCalledWith(
      expect.objectContaining({ command: `sf org login web --alias '${DEFAULT_ALIAS}' --set-default-dev-hub` })
    );
  });

  it('cancels (UserCancellationError) and does not exec when the alias prompt is dismissed (undefined)', async () => {
    jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce(undefined);
    const simpleExec = jest.fn(() => Effect.succeed(''));

    const exit = await run({ isProject: true, simpleExec });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('UserCancellationError');
    expect(simpleExec).not.toHaveBeenCalled();
    expect(updateAggregators).not.toHaveBeenCalled();
  });

  it('fails (getSfProject) and does not exec when not in a project', async () => {
    jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce('myHub');
    const simpleExec = jest.fn(() => Effect.succeed(''));

    const exit = await run({ isProject: false, simpleExec });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('FailedToResolveSfProjectError');
    expect(simpleExec).not.toHaveBeenCalled();
  });

  it('does not update the config/state aggregators when the exec fails', async () => {
    jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce('myHub');
    const simpleExec = jest.fn(() => Effect.fail({ _tag: 'TerminalServiceError' as const }));

    const exit = await run({ isProject: true, simpleExec });

    expect(Exit.isFailure(exit)).toBe(true);
    expect(simpleExec).toHaveBeenCalledTimes(1);
    // aggregators run only after a successful exec; the failed fiber short-circuits before reaching them
    expect(updateAggregators).not.toHaveBeenCalled();
  });

  it('shows the verification-code modal before exec (no-op branch returns void)', async () => {
    const order: string[] = [];
    jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce('myHub');
    showVerification.mockImplementation(() => {
      order.push('verify');
      return Promise.resolve();
    });
    const simpleExec = jest.fn(() => {
      order.push('exec');
      return Effect.succeed('');
    });

    const exit = await run({ isProject: true, simpleExec });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(showVerification).toHaveBeenCalledTimes(1);
    // modal must show before the browser-auth exec so the code is visible during the flow
    expect(order).toEqual(['verify', 'exec']);
  });
});
