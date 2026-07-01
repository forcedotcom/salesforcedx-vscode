/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { orgOpenCommand } from '../../../src/commands/orgOpen';

const SUCCESS_STDOUT = JSON.stringify({
  status: 0,
  result: { orgId: '00Dxx', username: 'me@scratch.org', url: 'https://example.my.salesforce.com/secur/frontdoor.jsp' }
});

type OrgSnapshot = { orgId?: string; username?: string };

const buildServices = (opts: {
  isProject: boolean;
  orgInfo: OrgSnapshot;
  simpleExec: jest.Mock;
  appendToChannel: jest.Mock;
  show: jest.Mock;
}) => ({
  // getSfProject sets the project context and fails when there's no project; orgOpen ignores the
  // returned SfProject, so the success path just yields a sentinel.
  ProjectService: {
    getSfProject: () =>
      opts.isProject ? Effect.succeed({}) : Effect.fail({ _tag: 'FailedToResolveSfProjectError' as const })
  },
  TerminalService: Effect.succeed({ simpleExec: opts.simpleExec }),
  ChannelService: Effect.succeed({
    appendToChannel: (msg: string) =>
      Effect.sync(() => {
        opts.appendToChannel(msg);
      }),
    // in-layer showChannel reveals the OutputChannel (no legacy ../channels singleton)
    showChannel: Effect.sync(() => {
      opts.show();
    })
  }),
  TargetOrgRef: () => SubscriptionRef.make(opts.orgInfo)
});

const run = (opts: {
  isProject: boolean;
  orgInfo: OrgSnapshot;
  simpleExec: jest.Mock;
  appendToChannel: jest.Mock;
  show: jest.Mock;
}) =>
  Effect.runPromiseExit(
    orgOpenCommand().pipe(
      Effect.provideService(ExtensionProviderService, {
        getServicesApi: Effect.succeed({ services: buildServices(opts) })
      } as unknown as ExtensionProviderService)
    ) as Effect.Effect<void, unknown, never>
  );

describe('orgOpenCommand', () => {
  let openExternal: jest.Mock;
  let show: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    openExternal = jest.fn().mockResolvedValue(true);
    show = jest.fn();
    // the global vscode mock has no env.openExternal; stub it per-test
    (vscode.env as unknown as { openExternal: jest.Mock }).openExternal = openExternal;
  });

  it('runs `sf org open --url-only --json` with --target-org (env injected by simpleExec)', async () => {
    const simpleExec = jest.fn(() => Effect.succeed(SUCCESS_STDOUT));
    const appendToChannel = jest.fn();
    const exit = await run({
      isProject: true,
      orgInfo: { orgId: '00Dxx', username: 'me@scratch.org' },
      simpleExec,
      appendToChannel,
      show
    });

    expect(Exit.isSuccess(exit)).toBe(true);
    // simpleExec injects SF_JSON_TO_STDOUT + FORCE_COLOR for sf commands; orgOpen no longer passes env
    expect(simpleExec).toHaveBeenCalledWith({
      command: 'sf org open --url-only --json --target-org me@scratch.org',
      parse: expect.any(Function)
    });
  });

  it('opens the url, appends the access message, and shows the channel on success', async () => {
    const simpleExec = jest.fn(() => Effect.succeed(SUCCESS_STDOUT));
    const appendToChannel = jest.fn();
    const exit = await run({
      isProject: true,
      orgInfo: { orgId: '00Dxx', username: 'me@scratch.org' },
      simpleExec,
      appendToChannel,
      show
    });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(openExternal).toHaveBeenCalledTimes(1);
    expect(String(openExternal.mock.calls[0][0])).toContain('frontdoor.jsp');
    expect(appendToChannel).toHaveBeenCalledWith(
      expect.stringContaining('https://example.my.salesforce.com/secur/frontdoor.jsp')
    );
    // in-layer showChannel, not the legacy ../channels singleton
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('omits --target-org when there is no default-org username', async () => {
    const simpleExec = jest.fn(() => Effect.succeed(SUCCESS_STDOUT));
    const appendToChannel = jest.fn();
    const exit = await run({ isProject: true, orgInfo: {}, simpleExec, appendToChannel, show });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(simpleExec).toHaveBeenCalledWith(expect.objectContaining({ command: 'sf org open --url-only --json' }));
  });

  it('fails (getSfProject) and does not exec or open when not in a project', async () => {
    const simpleExec = jest.fn(() => Effect.succeed(SUCCESS_STDOUT));
    const appendToChannel = jest.fn();
    const exit = await run({
      isProject: false,
      orgInfo: { username: 'me@scratch.org' },
      simpleExec,
      appendToChannel,
      show
    });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('FailedToResolveSfProjectError');
    expect(simpleExec).not.toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('appends the failure message and does not open when sf returns a failure result', async () => {
    const failureStdout = JSON.stringify({ status: 1, message: 'No default org set' });
    const simpleExec = jest.fn(() => Effect.succeed(failureStdout));
    const appendToChannel = jest.fn();
    const exit = await run({
      isProject: true,
      orgInfo: { username: 'me@scratch.org' },
      simpleExec,
      appendToChannel,
      show
    });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(appendToChannel).toHaveBeenCalledWith('No default org set');
    expect(openExternal).not.toHaveBeenCalled();
    // failure branch still reveals the channel so the error message is visible
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('fails with OrgOpenParseError on malformed stdout and does not open', async () => {
    const simpleExec = jest.fn(() => Effect.succeed('not json at all'));
    const appendToChannel = jest.fn();
    const exit = await run({
      isProject: true,
      orgInfo: { username: 'me@scratch.org' },
      simpleExec,
      appendToChannel,
      show
    });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('OrgOpenParseError');
    expect(openExternal).not.toHaveBeenCalled();
  });
});
