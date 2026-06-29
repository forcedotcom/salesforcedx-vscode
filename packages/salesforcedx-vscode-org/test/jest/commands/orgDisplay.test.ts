/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import { orgDisplayDefaultCommand, orgDisplayUsernameCommand } from '../../../src/commands/orgDisplay';
import { OrgInfo } from '../../../src/types/orgInfo';
import * as orgDisplayUtil from '../../../src/util/orgDisplay';

// Both commands compose the org-info Effects from util/orgDisplay; mock the module so the tests
// assert command-level orchestration (precondition, channel writes, cancellation). The real
// SOQL/Org.create path is covered by the e2e spec.
const gatherOrgForDisplay = jest.fn();
jest.mock('../../../src/parameterGatherers/selectOrgForDisplay', () => ({
  gatherOrgForDisplay: () => gatherOrgForDisplay()
}));
jest.mock('../../../src/util/orgDisplay');
const orgInfoFromConnection = orgDisplayUtil.orgInfoFromConnection as unknown as jest.Mock;
const getOrgInfoEffect = orgDisplayUtil.getOrgInfoEffect as unknown as jest.Mock;

const ORG_INFO: OrgInfo = {
  username: 'me@scratch.org',
  devHubId: '',
  id: '00Dxx',
  createdBy: '',
  createdDate: '',
  expirationDate: '',
  status: 'Connected',
  edition: 'Enterprise',
  orgName: 'Test Org',
  accessToken: 'tok',
  instanceUrl: 'https://test.salesforce.com',
  clientId: 'cid',
  apiVersion: '',
  aliases: [],
  connectionStatus: 'Connected',
  password: ''
};

const FAKE_CONN = { fake: 'connection' } as unknown as Connection;

const UserCancellationError = class extends Error {
  public readonly _tag = 'UserCancellationError';
};

const buildServices = (opts: {
  isProject: boolean;
  getConnection: Effect.Effect<Connection, unknown>;
  appendToChannel: jest.Mock;
  show: jest.Mock;
}) => ({
  ProjectService: {
    getSfProject: () =>
      opts.isProject ? Effect.succeed({}) : Effect.fail({ _tag: 'FailedToResolveSfProjectError' as const })
  },
  ConnectionService: { getConnection: () => opts.getConnection },
  ChannelService: Effect.succeed({
    appendToChannel: (msg: string) =>
      Effect.sync(() => {
        opts.appendToChannel(msg);
      }),
    showChannel: Effect.sync(() => {
      opts.show();
    })
  })
});

// The real command Effects require more than ExtensionProviderService in their R channel (the
// org-info/picker helpers add Alias/Channel/Connection/Project services); those are satisfied at
// runtime by the jest-mocked modules, so widen the command's R to ExtensionProviderService for the
// type-only provide and erase the remaining R via the final cast.
const runCommand = (
  command: typeof orgDisplayDefaultCommand | typeof orgDisplayUsernameCommand,
  opts: {
    isProject: boolean;
    getConnection: Effect.Effect<Connection, unknown>;
    appendToChannel: jest.Mock;
    show: jest.Mock;
  }
) =>
  Effect.runPromiseExit(
    (command() as Effect.Effect<void, unknown, ExtensionProviderService>).pipe(
      Effect.provideService(ExtensionProviderService, {
        getServicesApi: Effect.succeed({ services: buildServices(opts) })
      } as unknown as ExtensionProviderService)
    ) as Effect.Effect<void, unknown, never>
  );

describe('orgDisplayDefaultCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    orgInfoFromConnection.mockImplementation(() => Effect.succeed(ORG_INFO));
  });

  it('derives org info from the default connection, appends warning + table, shows the channel', async () => {
    const appendToChannel = jest.fn();
    const show = jest.fn();
    const exit = await runCommand(orgDisplayDefaultCommand, {
      isProject: true,
      getConnection: Effect.succeed(FAKE_CONN),
      appendToChannel,
      show
    });

    expect(Exit.isSuccess(exit)).toBe(true);
    // a stable, unconditional row of the rendered table proves orgInfo flowed into formatOrgInfoAsTable
    expect(appendToChannel).toHaveBeenCalledWith(expect.stringContaining('Connected Status'));
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('short-circuits on no project: no getConnection, no append', async () => {
    const appendToChannel = jest.fn();
    const show = jest.fn();
    const getConnection = Effect.succeed(FAKE_CONN);
    const exit = await runCommand(orgDisplayDefaultCommand, { isProject: false, getConnection, appendToChannel, show });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('FailedToResolveSfProjectError');
    expect(orgInfoFromConnection).not.toHaveBeenCalled();
    expect(appendToChannel).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
  });

  it('fails typed on no target org: getConnection fails, no append', async () => {
    const appendToChannel = jest.fn();
    const show = jest.fn();
    const exit = await runCommand(orgDisplayDefaultCommand, {
      isProject: true,
      getConnection: Effect.fail({ _tag: 'NoTargetOrgConfiguredError' as const }),
      appendToChannel,
      show
    });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('NoTargetOrgConfiguredError');
    expect(orgInfoFromConnection).not.toHaveBeenCalled();
    expect(appendToChannel).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
  });
});

describe('orgDisplayUsernameCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getOrgInfoEffect.mockImplementation(() => Effect.succeed(ORG_INFO));
  });

  it('picks an org, fetches org info, writes the warning + table, and shows the channel', async () => {
    gatherOrgForDisplay.mockReturnValue(Effect.succeed({ username: 'me@scratch.org' }));
    const appendToChannel = jest.fn();
    const show = jest.fn();

    const exit = await runCommand(orgDisplayUsernameCommand, {
      isProject: true,
      getConnection: Effect.succeed(FAKE_CONN),
      appendToChannel,
      show
    });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(getOrgInfoEffect).toHaveBeenCalledWith('me@scratch.org');
    // warning is the first channel write, then the rendered table (contains the Username row)
    expect(appendToChannel.mock.calls[0][0]).toContain('Warning: This command will expose sensitive information');
    expect(appendToChannel.mock.calls.some(([msg]) => String(msg).includes('Username'))).toBe(true);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('propagates UserCancellationError (no channel writes) when the picker is cancelled', async () => {
    gatherOrgForDisplay.mockReturnValue(Effect.fail(new UserCancellationError()));
    const appendToChannel = jest.fn();
    const show = jest.fn();

    const exit = await runCommand(orgDisplayUsernameCommand, {
      isProject: true,
      getConnection: Effect.succeed(FAKE_CONN),
      appendToChannel,
      show
    });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('UserCancellationError');
    expect(getOrgInfoEffect).not.toHaveBeenCalled();
    expect(appendToChannel).not.toHaveBeenCalled();
  });

  it('fails the precondition (getSfProject) and never pickers when there is no project', async () => {
    gatherOrgForDisplay.mockReturnValue(Effect.succeed({ username: 'me@scratch.org' }));
    const appendToChannel = jest.fn();
    const show = jest.fn();

    const exit = await runCommand(orgDisplayUsernameCommand, {
      isProject: false,
      getConnection: Effect.succeed(FAKE_CONN),
      appendToChannel,
      show
    });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('FailedToResolveSfProjectError');
    expect(gatherOrgForDisplay).not.toHaveBeenCalled();
  });
});
