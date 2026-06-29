/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import { OrgInfo } from '../../../src/types/orgInfo';

// The command composes the picker (gatherOrgForDisplay) and the org-info Effect (getOrgInfoEffect);
// mock both so the test asserts the command's orchestration (precondition, channel writes, cancellation).
const gatherOrgForDisplay = jest.fn();
const getOrgInfoEffect = jest.fn();

jest.mock('../../../src/parameterGatherers/selectOrgForDisplay', () => ({
  gatherOrgForDisplay: () => gatherOrgForDisplay()
}));
jest.mock('../../../src/util/orgDisplay', () => ({
  getOrgInfoEffect: (username?: string) => getOrgInfoEffect(username),
  // getOrgInfo is imported by the legacy default-org executor in the same module under test.
  getOrgInfo: jest.fn()
}));

import { orgDisplayUsernameCommand } from '../../../src/commands/orgDisplay';

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

const UserCancellationError = class extends Error {
  public readonly _tag = 'UserCancellationError';
};

const run = (opts: { isProject: boolean; appendToChannel: jest.Mock; show: jest.Mock }) =>
  Effect.runPromiseExit(
    orgDisplayUsernameCommand().pipe(
      Effect.provideService(ExtensionProviderService, {
        getServicesApi: Effect.succeed({
          services: {
            ProjectService: {
              getSfProject: () =>
                opts.isProject ? Effect.succeed({}) : Effect.fail({ _tag: 'FailedToResolveSfProjectError' as const })
            },
            ChannelService: Effect.succeed({
              appendToChannel: (msg: string) => Effect.sync(() => opts.appendToChannel(msg)),
              showChannel: Effect.sync(() => opts.show())
            })
          }
        })
      } as unknown as ExtensionProviderService)
    ) as Effect.Effect<void, unknown, never>
  );

describe('orgDisplayUsernameCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('picks an org, fetches org info, writes the warning + table, and shows the channel', async () => {
    gatherOrgForDisplay.mockReturnValue(Effect.succeed({ username: 'me@scratch.org' }));
    getOrgInfoEffect.mockReturnValue(Effect.succeed(ORG_INFO));
    const appendToChannel = jest.fn();
    const show = jest.fn();

    const exit = await run({ isProject: true, appendToChannel, show });

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

    const exit = await run({ isProject: true, appendToChannel, show });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('UserCancellationError');
    expect(getOrgInfoEffect).not.toHaveBeenCalled();
    expect(appendToChannel).not.toHaveBeenCalled();
  });

  it('fails the precondition (getSfProject) and never pickers when there is no project', async () => {
    gatherOrgForDisplay.mockReturnValue(Effect.succeed({ username: 'me@scratch.org' }));
    const appendToChannel = jest.fn();
    const show = jest.fn();

    const exit = await run({ isProject: false, appendToChannel, show });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('FailedToResolveSfProjectError');
    expect(gatherOrgForDisplay).not.toHaveBeenCalled();
  });
});
