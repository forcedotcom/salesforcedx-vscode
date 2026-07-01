/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import { orgLoginAccessTokenCommand } from '../../../../src/commands/auth/orgLoginAccessToken';

const userCancellationError = { _tag: 'UserCancellationError', message: 'User cancelled' } as const;

type AccessTokenParams = { instanceUrl: string; alias: string; accessToken: string };
const mockGather = jest.fn<Effect.Effect<AccessTokenParams, typeof userCancellationError>, []>();
jest.mock('../../../../src/commands/auth/authParamsGatherer', () => ({
  gatherAccessTokenParams: () => mockGather()
}));

const mockUpdateConfigAndStateAggregators = jest.fn<Promise<void>, []>();
jest.mock('../../../../src/util/orgUtil', () => ({
  updateConfigAndStateAggregators: () => mockUpdateConfigAndStateAggregators()
}));

const buildServices = (simpleExec: jest.Mock) => ({
  TerminalService: Effect.succeed({ simpleExec }),
  ChannelService: Effect.succeed({ appendToChannel: () => Effect.void, showChannel: Effect.void })
});

const run = (simpleExec: jest.Mock) =>
  Effect.runPromiseExit(
    orgLoginAccessTokenCommand().pipe(
      Effect.provideService(ExtensionProviderService, {
        getServicesApi: Effect.succeed({ services: buildServices(simpleExec) })
      } as unknown as ExtensionProviderService)
    ) as Effect.Effect<void, unknown, never>
  );

describe('orgLoginAccessTokenCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateConfigAndStateAggregators.mockResolvedValue(undefined);
  });

  it('execs the CLI with instance-url, quoted alias, set-default, no-prompt; token rides env not argv', async () => {
    mockGather.mockReturnValue(
      Effect.succeed({ instanceUrl: 'https://my.salesforce.com', alias: 'MyOrg', accessToken: 'sid-secret-123' })
    );
    const simpleExec = jest.fn(() => Effect.succeed('authorized'));

    const exit = await run(simpleExec);

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(simpleExec).toHaveBeenCalledWith({
      command:
        'sf org login access-token --instance-url "https://my.salesforce.com" --alias "MyOrg" --set-default --no-prompt',
      parse: expect.any(Function),
      env: { SF_ACCESS_TOKEN: 'sid-secret-123' }
    });
    // exact-match above proves the token is absent from the command string (only present under env)
    expect(mockUpdateConfigAndStateAggregators).toHaveBeenCalledTimes(1);
  });

  it('surfaces UserCancellationError untransformed when the gatherer cancels', async () => {
    mockGather.mockReturnValue(Effect.fail(userCancellationError));

    const exit = await run(jest.fn(() => Effect.succeed('authorized')));

    // command must not swallow/retag the cancellation; registerCommand relies on the tag to stay silent
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('UserCancellationError');
  });
});
