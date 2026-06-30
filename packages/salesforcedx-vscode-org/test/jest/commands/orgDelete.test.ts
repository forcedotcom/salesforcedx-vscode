/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Cause from 'effect/Cause';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { orgDeleteDefaultCommand, orgDeleteUsernameCommand } from '../../../src/commands/orgDelete';
import type { OrgToDelete } from '../../../src/parameterGatherers/selectDeletableOrg';

jest.mock('../../../src/channels', () => ({
  channelService: { appendLine: jest.fn(), showChannelOutput: jest.fn() },
  OUTPUT_CHANNEL: {}
}));

const mockUpdateConfigAndStateAggregators = jest.fn<Promise<void>, []>();
jest.mock('../../../src/util/orgUtil', () => ({
  updateConfigAndStateAggregators: () => mockUpdateConfigAndStateAggregators()
}));

const mockGather = jest.fn<Effect.Effect<{ orgs: OrgToDelete[] }, { _tag: 'UserCancellationError' }>, []>();
jest.mock('../../../src/parameterGatherers/selectDeletableOrg', () => ({
  gather: () => mockGather()
}));

const userCancellationError = { _tag: 'UserCancellationError', message: 'User cancelled' } as const;

type OrgSnapshot = { orgId?: string; username?: string; isScratch?: boolean; isSandbox?: boolean };

const buildServices = (orgInfo: OrgSnapshot, confirm: boolean, simpleExec: jest.Mock) => ({
  PromptService: Effect.succeed({
    confirmOrThrow: (_params: { message: string; confirmLabel: string }) =>
      confirm ? Effect.void : Effect.fail(userCancellationError),
    withCancellableProgress:
      <A, E>(_message: string) =>
      (effect: Effect.Effect<A, E>) =>
        effect
  }),
  TerminalService: Effect.succeed({ simpleExec }),
  ChannelService: Effect.succeed({ appendToChannel: () => Effect.void }),
  TargetOrgRef: () => SubscriptionRef.make(orgInfo)
});

const run = (orgInfo: OrgSnapshot, confirm: boolean, simpleExec: jest.Mock) =>
  Effect.runPromiseExit(
    orgDeleteDefaultCommand().pipe(
      Effect.provideService(ExtensionProviderService, {
        getServicesApi: Effect.succeed({ services: buildServices(orgInfo, confirm, simpleExec) })
      } as unknown as ExtensionProviderService)
    ) as Effect.Effect<void, unknown, never>
  );

describe('orgDeleteDefaultCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateConfigAndStateAggregators.mockResolvedValue(undefined);
  });

  it('runs `sf org delete scratch` for a scratch default org', async () => {
    const simpleExec = jest.fn(() => Effect.succeed('deleted'));
    const exit = await run({ orgId: '00D', isScratch: true }, true, simpleExec);

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(simpleExec).toHaveBeenCalledWith({
      command: 'sf org delete scratch --no-prompt',
      parse: expect.any(Function),
      timeout: Duration.seconds(120)
    });
    expect(mockUpdateConfigAndStateAggregators).toHaveBeenCalledTimes(1);
  });

  it('runs `sf org delete sandbox` for a sandbox default org', async () => {
    const simpleExec = jest.fn(() => Effect.succeed('deleted'));
    const exit = await run({ orgId: '00D', isSandbox: true }, true, simpleExec);

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(simpleExec).toHaveBeenCalledWith({
      command: 'sf org delete sandbox --no-prompt',
      parse: expect.any(Function),
      timeout: Duration.seconds(120)
    });
  });

  it('passes --target-org so delete does not depend on the extension-host cwd', async () => {
    const simpleExec = jest.fn(() => Effect.succeed('deleted'));
    const exit = await run({ orgId: '00D', username: 'me@scratch.org', isScratch: true }, true, simpleExec);

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(simpleExec).toHaveBeenCalledWith({
      command: 'sf org delete scratch --target-org me@scratch.org --no-prompt',
      parse: expect.any(Function),
      timeout: Duration.seconds(120)
    });
  });

  it('fails with OrgNotDeletableError and does not exec for a non-scratch/non-sandbox default org', async () => {
    const simpleExec = jest.fn(() => Effect.succeed('deleted'));
    const exit = await run({ orgId: '00D', username: 'me@prod.org' }, true, simpleExec);

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('OrgNotDeletableError');
    expect(simpleExec).not.toHaveBeenCalled();
    expect(mockUpdateConfigAndStateAggregators).not.toHaveBeenCalled();
  });

  it('fails with UserCancellationError and does not exec when the user declines', async () => {
    const simpleExec = jest.fn(() => Effect.succeed('deleted'));
    const exit = await run({ orgId: '00D', isScratch: true }, false, simpleExec);

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('UserCancellationError');
    expect(simpleExec).not.toHaveBeenCalled();
    expect(mockUpdateConfigAndStateAggregators).not.toHaveBeenCalled();
  });
});

// Mirrors the real TerminalServiceError (terminalService.ts) so the partial-failure test exercises the
// actual error shape the catchTag captures, not a hand-rolled stand-in.
class TerminalServiceError extends Schema.TaggedError<TerminalServiceError>()('TerminalServiceError', {
  message: Schema.String,
  command: Schema.String
}) {}

// Mirrors the real UserCancellationError (promptService.ts) that withCancellableProgress surfaces when the
// user clicks Cancel. Unlike a TerminalServiceError it must NOT be caught per-org; it aborts the whole loop.
class UserCancellationError extends Schema.TaggedError<UserCancellationError>()('UserCancellationError', {
  message: Schema.String
}) {}

const appendToChannel = jest.fn<Effect.Effect<void>, [string]>();

// Mirrors the real withCancellableProgress (promptService.ts): a fiber interrupt (Cancel) is converted into a
// typed UserCancellationError. Modeling it this way lets the cancellation test interrupt mid-loop the same way
// clicking Cancel does, instead of faking a typed failure out of simpleExec.
const buildUsernameServices = (simpleExec: jest.Mock) => ({
  PromptService: Effect.succeed({
    withCancellableProgress:
      <A, E>(_message: string) =>
      (effect: Effect.Effect<A, E>) =>
        effect.pipe(
          Effect.catchAllCause(cause =>
            Cause.isInterruptedOnly(cause)
              ? Effect.fail<UserCancellationError | E>(
                  new UserCancellationError({ message: 'User cancelled progress' })
                )
              : Effect.failCause<UserCancellationError | E>(cause)
          )
        )
  }),
  TerminalService: Effect.succeed({ simpleExec }),
  ChannelService: Effect.succeed({ appendToChannel, showChannel: Effect.void })
});

const runUsername = (simpleExec: jest.Mock) =>
  Effect.runPromiseExit(
    orgDeleteUsernameCommand().pipe(
      Effect.provideService(ExtensionProviderService, {
        getServicesApi: Effect.succeed({ services: buildUsernameServices(simpleExec) })
      } as unknown as ExtensionProviderService)
    ) as Effect.Effect<void, unknown, never>
  );

const scratchOrg: OrgToDelete = { username: 'a@scratch.org', orgType: 'scratch' };
const sandboxOrg: OrgToDelete = { username: 'b@sandbox.org', orgType: 'sandbox' };

describe('orgDeleteUsernameCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateConfigAndStateAggregators.mockResolvedValue(undefined);
    // resetMocks:true (jest.base.config) clears impls each test, so (re)set them here
    appendToChannel.mockReturnValue(Effect.void);
  });

  it('deletes each picked org with the right scratch/sandbox subcommand and --target-org', async () => {
    mockGather.mockReturnValue(Effect.succeed({ orgs: [scratchOrg, sandboxOrg] }));
    const simpleExec = jest.fn(() => Effect.succeed('deleted'));

    const exit = await runUsername(simpleExec);

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(simpleExec).toHaveBeenNthCalledWith(1, {
      command: 'sf org delete scratch --target-org a@scratch.org --no-prompt',
      parse: expect.any(Function),
      timeout: Duration.seconds(120)
    });
    expect(simpleExec).toHaveBeenNthCalledWith(2, {
      command: 'sf org delete sandbox --target-org b@sandbox.org --no-prompt',
      parse: expect.any(Function),
      timeout: Duration.seconds(120)
    });
    expect(mockUpdateConfigAndStateAggregators).toHaveBeenCalledTimes(1);
  });

  it('continues past a failed org (TerminalServiceError caught), appends a failure line, and fails overall', async () => {
    mockGather.mockReturnValue(Effect.succeed({ orgs: [scratchOrg, sandboxOrg] }));
    // org-1 fails the way the real service does: childProcess.exec rejects on non-zero exit, wrapped in
    // Effect.tryPromise -> TerminalServiceError. A bare simpleExec loop would short-circuit here and never run org-2.
    const simpleExec = jest.fn((args: { command: string }) =>
      args.command.includes('a@scratch.org')
        ? Effect.tryPromise({
            try: () => Promise.reject(new Error('Command failed: non-zero exit')),
            catch: e =>
              new TerminalServiceError({
                message: e instanceof Error ? e.message : 'exec failed',
                command: args.command
              })
          })
        : Effect.succeed('deleted')
    );

    const exit = await runUsername(simpleExec);

    // loop did NOT abort: org-2 still ran
    expect(simpleExec).toHaveBeenCalledTimes(2);
    expect(simpleExec).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ command: expect.stringContaining('b@sandbox.org') })
    );
    // failure line for org-1
    expect(appendToChannel).toHaveBeenCalledWith(
      'Failed to delete a@scratch.org (scratch org). Check the output above for details.'
    );
    // cache flush still runs after the loop despite partial failure
    expect(mockUpdateConfigAndStateAggregators).toHaveBeenCalledTimes(1);
    // overall failure surfaces (reaches handleCause)
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('OrgDeleteFailedError');
  });

  it('aborts the loop on cancellation (interrupt is not bucketed by partition)', async () => {
    mockGather.mockReturnValue(Effect.succeed({ orgs: [scratchOrg, sandboxOrg] }));
    // Cancelling mid-delete: clicking Cancel interrupts the loop fiber. Because withCancellableProgress wraps the
    // whole partition (not each org), the interrupt aborts the loop; partition's per-element Effect.either only
    // recovers typed failures, so it does NOT bucket the interrupt and continue. The progress wrapper then turns
    // the interrupt into a UserCancellationError. (A typed TerminalServiceError, by contrast, IS bucketed.)
    const simpleExec = jest.fn((args: { command: string }) =>
      args.command.includes('a@scratch.org') ? Effect.interrupt : Effect.succeed('deleted')
    );

    const exit = await runUsername(simpleExec);

    // loop aborted: org-2 never ran
    expect(simpleExec).toHaveBeenCalledTimes(1);
    // no partial-failure summary; the cancellation propagates as-is
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(JSON.stringify(exit.cause)).toContain('UserCancellationError');
      expect(JSON.stringify(exit.cause)).not.toContain('OrgDeleteFailedError');
    }
    // cache flush does NOT run: the fiber short-circuited before reaching it
    expect(mockUpdateConfigAndStateAggregators).not.toHaveBeenCalled();
  });

  it('does not delete or flush when the picker cancels', async () => {
    mockGather.mockReturnValue(Effect.fail(userCancellationError));
    const simpleExec = jest.fn(() => Effect.succeed('deleted'));

    const exit = await runUsername(simpleExec);

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('UserCancellationError');
    expect(simpleExec).not.toHaveBeenCalled();
    expect(mockUpdateConfigAndStateAggregators).not.toHaveBeenCalled();
  });
});
