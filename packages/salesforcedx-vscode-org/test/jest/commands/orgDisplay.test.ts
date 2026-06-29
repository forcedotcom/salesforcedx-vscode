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
import { orgDisplayDefaultCommand } from '../../../src/commands/orgDisplay';
import { OrgInfo } from '../../../src/types/orgInfo';
import * as orgDisplayUtil from '../../../src/util/orgDisplay';

// Mock the connection-driven helper so the command test stays at the command level
// (the helper's real SOQL/Org.create path is covered by the e2e spec).
jest.mock('../../../src/util/orgDisplay');
const orgInfoFromConnection = orgDisplayUtil.orgInfoFromConnection as unknown as jest.Mock;

const ORG_INFO: OrgInfo = {
  username: 'me@scratch.org',
  devHubId: '',
  id: '00Dxx',
  createdBy: '',
  createdDate: '',
  expirationDate: '',
  status: 'Connected',
  edition: 'Developer',
  orgName: 'Acme',
  accessToken: 'token',
  instanceUrl: 'https://example.my.salesforce.com',
  clientId: 'client',
  apiVersion: '60.0',
  aliases: ['vscodeOrg'],
  connectionStatus: 'Connected'
};

const FAKE_CONN = { fake: 'connection' } as unknown as Connection;

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

const run = (opts: {
  isProject: boolean;
  getConnection: Effect.Effect<Connection, unknown>;
  appendToChannel: jest.Mock;
  show: jest.Mock;
}) =>
  Effect.runPromiseExit(
    orgDisplayDefaultCommand().pipe(
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
    const exit = await run({
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
    const exit = await run({ isProject: false, getConnection, appendToChannel, show });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('FailedToResolveSfProjectError');
    expect(orgInfoFromConnection).not.toHaveBeenCalled();
    expect(appendToChannel).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
  });

  it('fails typed on no target org: getConnection fails, no append', async () => {
    const appendToChannel = jest.fn();
    const show = jest.fn();
    const exit = await run({
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
