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
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { orgDisplayDefaultCommand, orgDisplayUsernameCommand } from '../../../src/commands/orgDisplay';

// Both commands shell out to `sf org display --json` via TerminalService.simpleExec (mirrors
// orgCreate/orgOpen); the picker is mocked so the tests assert command construction, table
// rendering from the CLI JSON, and the failure/parse branches.
const gatherOrgForDisplay = jest.fn();
jest.mock('../../../src/parameterGatherers/selectOrgForDisplay', () => ({
  gatherOrgForDisplay: () => gatherOrgForDisplay()
}));

class UserCancellationError extends Schema.TaggedError<UserCancellationError>()('UserCancellationError', {
  message: Schema.optional(Schema.String)
}) {}

/** Same tag as the real services error, so the command's catchTag recovers it. */
class TerminalServiceError extends Schema.TaggedError<TerminalServiceError>()('TerminalServiceError', {
  message: Schema.String,
  command: Schema.String
}) {}

const SCRATCH_RESULT = {
  id: '00Dxx',
  devHubId: 'devhub@example.com',
  apiVersion: '67.0',
  accessToken: "[REDACTED] Use 'sf org auth show-access-token' to view",
  instanceUrl: 'https://scratch.my.salesforce.com',
  username: 'me@scratch.org',
  clientId: 'PlatformCLI',
  status: 'Active',
  expirationDate: '2026-07-27',
  createdBy: 'devhub@example.com',
  edition: 'Developer',
  orgName: 'Company',
  createdDate: '2026-07-20T19:51:33.000+0000',
  alias: 'minimalTestOrg'
};

const NON_SCRATCH_RESULT = {
  id: '00D6A',
  apiVersion: '67.0',
  accessToken: "[REDACTED] Use 'sf org auth show-access-token' to view",
  instanceUrl: 'https://hub.my.salesforce.com',
  username: 'hub@example.com',
  clientId: 'PlatformCLI',
  connectedStatus: 'Connected',
  alias: 'hub'
};

const stdoutFor = (result: Record<string, unknown>) => JSON.stringify({ status: 0, result });

type OrgSnapshot = { orgId?: string; username?: string };

type Opts = {
  isProject?: boolean;
  orgInfo?: OrgSnapshot;
  simpleExec: jest.Mock;
  appendToChannel: jest.Mock;
  show: jest.Mock;
};

const buildServices = (opts: Opts) => ({
  ProjectService: {
    getSfProject: () =>
      opts.isProject === false ? Effect.fail({ _tag: 'FailedToResolveSfProjectError' as const }) : Effect.succeed({})
  },
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
  TargetOrgRef: () => SubscriptionRef.make(opts.orgInfo ?? { username: 'me@scratch.org' })
});

const run = (command: typeof orgDisplayDefaultCommand | typeof orgDisplayUsernameCommand, opts: Opts) =>
  Effect.runPromiseExit(
    (command() as Effect.Effect<void, unknown, ExtensionProviderService>).pipe(
      Effect.provideService(ExtensionProviderService, {
        getServicesApi: Effect.succeed({ services: buildServices(opts) })
      } as unknown as ExtensionProviderService)
    ) as Effect.Effect<void, unknown, never>
  );

describe('orgDisplayDefaultCommand', () => {
  let simpleExec: jest.Mock;
  let appendToChannel: jest.Mock;
  let show: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    simpleExec = jest.fn(() => Effect.succeed(stdoutFor(SCRATCH_RESULT)));
    appendToChannel = jest.fn();
    show = jest.fn();
  });

  it('runs `sf org display --target-org "<default>" --json` and writes the table to the channel', async () => {
    const exit = await run(orgDisplayDefaultCommand, { simpleExec, appendToChannel, show });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(simpleExec).toHaveBeenCalledWith({
      command: 'sf org display --target-org "me@scratch.org" --json',
      parse: expect.any(Function)
    });
    // 'Connected Status' is an unconditional row of formatOrgInfoAsTable; the scratch-org values
    // prove the CLI JSON flowed into the table
    expect(appendToChannel.mock.calls[0][0]).toContain('Connected Status');
    expect(appendToChannel.mock.calls[0][0]).toContain('Dev Hub Id');
    expect(appendToChannel.mock.calls[0][0]).toContain('me@scratch.org');
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('omits --target-org (sf resolves its own default) when no default-org username is tracked', async () => {
    const exit = await run(orgDisplayDefaultCommand, { orgInfo: {}, simpleExec, appendToChannel, show });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(simpleExec).toHaveBeenCalledWith(expect.objectContaining({ command: 'sf org display --json' }));
  });

  it('renders the non-scratch table (connectedStatus, no scratch block)', async () => {
    simpleExec = jest.fn(() => Effect.succeed(stdoutFor(NON_SCRATCH_RESULT)));

    const exit = await run(orgDisplayDefaultCommand, { simpleExec, appendToChannel, show });

    expect(Exit.isSuccess(exit)).toBe(true);
    const table = appendToChannel.mock.calls[0][0];
    expect(table).toContain('Connected');
    expect(table).not.toContain('Dev Hub Id');
    expect(table).not.toContain('Expiration Date');
  });

  it('fails (getSfProject) without exec when not in a project', async () => {
    const exit = await run(orgDisplayDefaultCommand, { isProject: false, simpleExec, appendToChannel, show });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('FailedToResolveSfProjectError');
    expect(simpleExec).not.toHaveBeenCalled();
    expect(appendToChannel).not.toHaveBeenCalled();
  });

  it('appends the failure message when sf returns a non-zero status (proves Match.tag dispatch)', async () => {
    simpleExec = jest.fn(() => Effect.succeed(JSON.stringify({ status: 68, message: 'No default environment found' })));

    const exit = await run(orgDisplayDefaultCommand, { simpleExec, appendToChannel, show });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(appendToChannel).toHaveBeenCalledWith('No default environment found');
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('recovers a non-zero exit (TerminalServiceError) and appends the CLI message from its payload', async () => {
    // sf exits non-zero on failure, so simpleExec fails; its message carries the JSON error payload,
    // which decodeTaggedCliResponse slices out of the `Command failed: ...` prefix.
    const command = 'sf org display --target-org "me@scratch.org" --json';
    simpleExec = jest.fn(() =>
      Effect.fail(
        new TerminalServiceError({
          command,
          message: `Command failed: ${command}\n${JSON.stringify({ status: 2, message: 'No authorization information found' })}`
        })
      )
    );

    const exit = await run(orgDisplayDefaultCommand, { simpleExec, appendToChannel, show });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(appendToChannel).toHaveBeenCalledWith('No authorization information found');
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('propagates a TerminalServiceError whose message carries no JSON (sf missing/spawn failure)', async () => {
    // infra failure, not a CLI-reported one: there is nothing to decode, so the typed error must reach
    // ErrorHandlerService with its real diagnostic instead of becoming an opaque OrgDisplayParseError.
    simpleExec = jest.fn(() =>
      Effect.fail(new TerminalServiceError({ command: 'sf org display --json', message: 'sh: sf: command not found' }))
    );

    const exit = await run(orgDisplayDefaultCommand, { simpleExec, appendToChannel, show });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(JSON.stringify(exit.cause)).toContain('TerminalServiceError');
      expect(JSON.stringify(exit.cause)).not.toContain('OrgDisplayParseError');
    }
    expect(appendToChannel).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
  });

  it('renders the table when stdout is prefixed with a CLI warning line', async () => {
    // sf can prepend non-JSON warning lines even with --json + SF_JSON_TO_STDOUT (seen on macOS CI).
    simpleExec = jest.fn(() =>
      Effect.succeed(`Warning: The following orgs expire in the next 5 days:\n${stdoutFor(SCRATCH_RESULT)}`)
    );

    const exit = await run(orgDisplayDefaultCommand, { simpleExec, appendToChannel, show });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(appendToChannel.mock.calls[0][0]).toContain('Dev Hub Id');
  });

  it('fails with OrgDisplayParseError on malformed stdout and writes nothing', async () => {
    simpleExec = jest.fn(() => Effect.succeed('not json at all'));

    const exit = await run(orgDisplayDefaultCommand, { simpleExec, appendToChannel, show });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('OrgDisplayParseError');
    expect(appendToChannel).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
  });
});

describe('orgDisplayUsernameCommand', () => {
  let simpleExec: jest.Mock;
  let appendToChannel: jest.Mock;
  let show: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    simpleExec = jest.fn(() => Effect.succeed(stdoutFor(SCRATCH_RESULT)));
    appendToChannel = jest.fn();
    show = jest.fn();
    gatherOrgForDisplay.mockReturnValue(Effect.succeed({ username: 'me@scratch.org' }));
  });

  it('runs `sf org display --target-org "<picked>" --json` for the picked org and writes the table', async () => {
    const exit = await run(orgDisplayUsernameCommand, { simpleExec, appendToChannel, show });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(simpleExec).toHaveBeenCalledWith({
      command: 'sf org display --target-org "me@scratch.org" --json',
      parse: expect.any(Function)
    });
    expect(appendToChannel.mock.calls[0][0]).toContain('Username');
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('quotes the picked username so a value with spaces survives /bin/sh -c word splitting', async () => {
    gatherOrgForDisplay.mockReturnValue(Effect.succeed({ username: 'my org@example.com' }));

    const exit = await run(orgDisplayUsernameCommand, { simpleExec, appendToChannel, show });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(simpleExec).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'sf org display --target-org "my org@example.com" --json' })
    );
  });

  it('propagates UserCancellationError (no exec, no channel writes) when the picker is cancelled', async () => {
    gatherOrgForDisplay.mockReturnValue(Effect.fail(new UserCancellationError({})));

    const exit = await run(orgDisplayUsernameCommand, { simpleExec, appendToChannel, show });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('UserCancellationError');
    expect(simpleExec).not.toHaveBeenCalled();
    expect(appendToChannel).not.toHaveBeenCalled();
  });

  it('fails the precondition (getSfProject) and never pickers when there is no project', async () => {
    const exit = await run(orgDisplayUsernameCommand, { isProject: false, simpleExec, appendToChannel, show });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('FailedToResolveSfProjectError');
    expect(gatherOrgForDisplay).not.toHaveBeenCalled();
    expect(simpleExec).not.toHaveBeenCalled();
  });
});
