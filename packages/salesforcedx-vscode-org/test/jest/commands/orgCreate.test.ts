/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';

// resetMocks: true (jest.base.config) wipes implementations before each test, so the impls are
// (re)installed in beforeEach; the factories only forward to these stable jest.fn references.
const updateConfigAndStateAggregators = jest.fn<Promise<void>, []>();
jest.mock('../../../src/util/orgUtil', () => ({
  updateConfigAndStateAggregators: () => updateConfigAndStateAggregators()
}));

const getTargetDevHubOrAlias = jest.fn<Promise<string | undefined>, [boolean]>();
jest.mock('@salesforce/salesforcedx-utils-vscode', () => ({
  getTargetDevHubOrAlias: (...args: [boolean]) => getTargetDevHubOrAlias(...args),
  workspaceUtils: {
    hasRootWorkspace: () => true,
    getRootWorkspace: () => ({ name: 'my-project' }),
    getRootWorkspacePath: () => '/repo'
  }
}));

// imported after mocks so the command picks up the mocked utils module
import { orgCreateCommand } from '../../../src/commands/orgCreate';

class UserCancellationError extends Schema.TaggedError<UserCancellationError>()('UserCancellationError', {
  message: Schema.optional(Schema.String)
}) {}

const SUCCESS_STDOUT = JSON.stringify({ status: 0, result: { orgId: '00Dxx', username: 'me@scratch.org' } });

type Services = {
  devHub: string | undefined;
  simpleExec: jest.Mock;
  appendToChannel: jest.Mock;
  show: jest.Mock;
  isProject?: boolean;
};

const buildServices = (opts: Services) => ({
  ProjectService: {
    getSfProject: () =>
      opts.isProject === false ? Effect.fail({ _tag: 'FailedToResolveSfProjectError' as const }) : Effect.succeed({})
  },
  ConfigService: { getTargetDevHub: () => Effect.succeed(opts.devHub) },
  PromptService: Effect.succeed({
    // production: fails on undefined/empty-trimmed; here we only need undefined → cancel
    considerUndefinedAsCancellation: <T>(value: T | undefined) =>
      value === undefined ? Effect.fail(new UserCancellationError({})) : Effect.succeed(value),
    // identity: run the wrapped effect directly (no real vscode progress in jest)
    withCancellableProgress:
      () =>
      <A, E, R>(self: Effect.Effect<A, E, R>) =>
        self
  }),
  TerminalService: Effect.succeed({ simpleExec: opts.simpleExec }),
  ChannelService: Effect.succeed({
    appendToChannel: (msg: string) =>
      Effect.sync(() => {
        opts.appendToChannel(msg);
      }),
    showChannel: Effect.sync(() => {
      opts.show();
    })
  }),
  UserCancellationError
});

const run = (opts: Services) =>
  Effect.runPromiseExit(
    orgCreateCommand().pipe(
      Effect.provideService(ExtensionProviderService, {
        getServicesApi: Effect.succeed({ services: buildServices(opts) })
      } as unknown as ExtensionProviderService)
    ) as Effect.Effect<void, unknown, never>
  );

describe('orgCreateCommand', () => {
  let showQuickPick: jest.Mock;
  let showInputBox: jest.Mock;
  let showErrorMessage: jest.Mock;
  let findFiles: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    updateConfigAndStateAggregators.mockResolvedValue(undefined);
    getTargetDevHubOrAlias.mockResolvedValue(undefined);
    showQuickPick = vscode.window.showQuickPick as unknown as jest.Mock;
    showInputBox = vscode.window.showInputBox as unknown as jest.Mock;
    showErrorMessage = vscode.window.showErrorMessage as unknown as jest.Mock;
    findFiles = vscode.workspace.findFiles as unknown as jest.Mock;
    // Utils.basename(uri) reads uri.path (not fsPath); provide both so the quickpick item label resolves
    findFiles.mockResolvedValue([
      { fsPath: '/repo/config/project-scratch-def.json', path: '/repo/config/project-scratch-def.json' }
    ]);
    showQuickPick.mockResolvedValue({ description: '/repo/config/project-scratch-def.json' });
    showInputBox.mockResolvedValue('myAlias');
  });

  it('runs `sf org create scratch ... --set-default --json`, refreshes aggregators, reports to channel', async () => {
    const simpleExec = jest.fn(() => Effect.succeed(SUCCESS_STDOUT));
    const appendToChannel = jest.fn();
    const show = jest.fn();
    showInputBox.mockResolvedValueOnce('myAlias').mockResolvedValueOnce('14');

    const exit = await run({ devHub: 'devhub@org', simpleExec, appendToChannel, show });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(simpleExec).toHaveBeenCalledWith(
      expect.objectContaining({
        command:
          'sf org create scratch --definition-file "/repo/config/project-scratch-def.json" --alias myAlias --duration-days 14 --set-default --json'
      })
    );
    expect(updateConfigAndStateAggregators).toHaveBeenCalledTimes(1);
    expect(appendToChannel).toHaveBeenCalledWith(expect.stringContaining('me@scratch.org'));
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('appends the failure message and does NOT refresh aggregators on non-zero status (proves Match.tag dispatch)', async () => {
    const simpleExec = jest.fn(() => Effect.succeed(JSON.stringify({ status: 1, message: 'create failed' })));
    const appendToChannel = jest.fn();
    const show = jest.fn();

    const exit = await run({ devHub: 'devhub@org', simpleExec, appendToChannel, show });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(appendToChannel).toHaveBeenCalledWith('create failed');
    expect(updateConfigAndStateAggregators).not.toHaveBeenCalled();
  });

  it('empty alias/days inputs fall back to the defaults', async () => {
    const simpleExec = jest.fn(() => Effect.succeed(SUCCESS_STDOUT));
    const appendToChannel = jest.fn();
    const show = jest.fn();
    showInputBox.mockResolvedValueOnce('').mockResolvedValueOnce('');

    const exit = await run({ devHub: 'devhub@org', simpleExec, appendToChannel, show });

    expect(Exit.isSuccess(exit)).toBe(true);
    // empty alias → sanitized folder name 'myproject'; empty days → DEFAULT_EXPIRATION_DAYS '7'
    expect(simpleExec).toHaveBeenCalledWith(
      expect.objectContaining({
        command:
          'sf org create scratch --definition-file "/repo/config/project-scratch-def.json" --alias myproject --duration-days 7 --set-default --json'
      })
    );
  });

  it('cancels (no exec) when the def-file picker is dismissed', async () => {
    const simpleExec = jest.fn(() => Effect.succeed(SUCCESS_STDOUT));
    const appendToChannel = jest.fn();
    const show = jest.fn();
    showQuickPick.mockResolvedValueOnce(undefined);

    const exit = await run({ devHub: 'devhub@org', simpleExec, appendToChannel, show });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('UserCancellationError');
    expect(simpleExec).not.toHaveBeenCalled();
  });

  it('cancels (no exec) when the alias input box is dismissed (Esc)', async () => {
    const simpleExec = jest.fn(() => Effect.succeed(SUCCESS_STDOUT));
    const appendToChannel = jest.fn();
    const show = jest.fn();
    showInputBox.mockResolvedValueOnce(undefined);

    const exit = await run({ devHub: 'devhub@org', simpleExec, appendToChannel, show });

    expect(Exit.isFailure(exit)).toBe(true);
    expect(simpleExec).not.toHaveBeenCalled();
  });

  it('shows the no-scratch-def error and cancels when no def files match', async () => {
    const simpleExec = jest.fn(() => Effect.succeed(SUCCESS_STDOUT));
    const appendToChannel = jest.fn();
    const show = jest.fn();
    findFiles.mockResolvedValueOnce([]);

    const exit = await run({ devHub: 'devhub@org', simpleExec, appendToChannel, show });

    expect(Exit.isFailure(exit)).toBe(true);
    expect(showErrorMessage).toHaveBeenCalledTimes(1);
    expect(simpleExec).not.toHaveBeenCalled();
  });

  it('shows the no-devhub warning and cancels before any picker when no devhub is configured', async () => {
    const simpleExec = jest.fn(() => Effect.succeed(SUCCESS_STDOUT));
    const appendToChannel = jest.fn();
    const show = jest.fn();

    const exit = await run({ devHub: undefined, simpleExec, appendToChannel, show });

    expect(Exit.isFailure(exit)).toBe(true);
    expect(getTargetDevHubOrAlias).toHaveBeenCalledWith(true);
    expect(findFiles).not.toHaveBeenCalled();
    expect(simpleExec).not.toHaveBeenCalled();
  });

  it('fails (getSfProject) without exec when not in a project', async () => {
    const simpleExec = jest.fn(() => Effect.succeed(SUCCESS_STDOUT));
    const appendToChannel = jest.fn();
    const show = jest.fn();

    const exit = await run({ devHub: 'devhub@org', isProject: false, simpleExec, appendToChannel, show });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('FailedToResolveSfProjectError');
    expect(simpleExec).not.toHaveBeenCalled();
  });

  it('fails with OrgCreateParseError on malformed stdout and does not refresh aggregators', async () => {
    const simpleExec = jest.fn(() => Effect.succeed('not json at all'));
    const appendToChannel = jest.fn();
    const show = jest.fn();

    const exit = await run({ devHub: 'devhub@org', simpleExec, appendToChannel, show });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('OrgCreateParseError');
    expect(updateConfigAndStateAggregators).not.toHaveBeenCalled();
  });
});
