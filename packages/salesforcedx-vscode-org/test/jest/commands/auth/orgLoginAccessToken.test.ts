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
import { orgLoginAccessToken } from '../../../../src/commands/auth/orgLoginAccessToken';

// re-create the tagged error locally so the command's catchTag('BadOAuthTokenError') matches by tag
class BadOAuthTokenError extends Schema.TaggedError<BadOAuthTokenError>()('BadOAuthTokenError', {
  message: Schema.String
}) {}
class FailedToSaveAuthInfoError extends Schema.TaggedError<FailedToSaveAuthInfoError>()('FailedToSaveAuthInfoError', {
  message: Schema.String
}) {}
class FailedToHandleAliasSettingsError extends Schema.TaggedError<FailedToHandleAliasSettingsError>()(
  'FailedToHandleAliasSettingsError',
  { message: Schema.String }
) {}

const PARAMS = { instanceUrl: 'https://my.salesforce.com', accessToken: '00Dxx!tok', alias: 'myAlias' };

const updateAggregators = jest.fn();
jest.mock('../../../../src/util/orgUtil', () => ({
  updateConfigAndStateAggregators: () => {
    updateAggregators();
    return Promise.resolve();
  }
}));

const gather = jest.fn<Effect.Effect<typeof PARAMS, unknown>, []>();
jest.mock('../../../../src/commands/auth/authParamsGatherer', () => ({
  gatherAccessTokenParams: () => gather()
}));

type Opts = {
  isProject: boolean;
  loginWithAccessToken: jest.Mock;
  showChannel: jest.Mock;
  gatherResult: Effect.Effect<typeof PARAMS, unknown>;
};

const buildServices = (opts: Opts) => ({
  ProjectService: {
    getSfProject: () =>
      opts.isProject ? Effect.succeed({}) : Effect.fail({ _tag: 'FailedToResolveSfProjectError' as const })
  },
  ConnectionService: { loginWithAccessToken: opts.loginWithAccessToken },
  ChannelService: Effect.succeed({
    showChannel: Effect.sync(opts.showChannel)
  })
});

const run = (opts: Opts) => {
  gather.mockReturnValue(opts.gatherResult);
  return Effect.runPromiseExit(
    orgLoginAccessToken().pipe(
      Effect.provideService(ExtensionProviderService, {
        getServicesApi: Effect.succeed({ services: buildServices(opts) })
      } as unknown as ExtensionProviderService)
    ) as Effect.Effect<void, unknown, never>
  );
};

describe('orgLoginAccessToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('happy path: gathers params, calls loginWithAccessToken with setDefault:true, refreshes aggregators', async () => {
    const loginWithAccessToken = jest.fn(() => Effect.succeed({ username: 'me@org.com' }));
    const showChannel = jest.fn();
    const exit = await run({
      isProject: true,
      loginWithAccessToken,
      showChannel,
      gatherResult: Effect.succeed(PARAMS)
    });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(loginWithAccessToken).toHaveBeenCalledWith({
      instanceUrl: PARAMS.instanceUrl,
      accessToken: PARAMS.accessToken,
      alias: PARAMS.alias,
      setDefault: true
    });
    expect(updateAggregators).toHaveBeenCalledTimes(1);
    expect(showChannel).not.toHaveBeenCalled();
  });

  it('bad-oauth: reveals the channel and re-fails with the same BadOAuthTokenError; no aggregator refresh', async () => {
    const err = new BadOAuthTokenError({ message: 'friendly session id message' });
    const loginWithAccessToken = jest.fn(() => Effect.fail(err));
    const showChannel = jest.fn();
    const exit = await run({
      isProject: true,
      loginWithAccessToken,
      showChannel,
      gatherResult: Effect.succeed(PARAMS)
    });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('BadOAuthTokenError');
    expect(showChannel).toHaveBeenCalledTimes(1);
    expect(updateAggregators).not.toHaveBeenCalled();
  });

  it('save-fail: propagates FailedToSaveAuthInfoError, no channel reveal, no aggregator refresh', async () => {
    const loginWithAccessToken = jest.fn(() => Effect.fail(new FailedToSaveAuthInfoError({ message: 'disk full' })));
    const showChannel = jest.fn();
    const exit = await run({
      isProject: true,
      loginWithAccessToken,
      showChannel,
      gatherResult: Effect.succeed(PARAMS)
    });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('FailedToSaveAuthInfoError');
    expect(showChannel).not.toHaveBeenCalled();
    expect(updateAggregators).not.toHaveBeenCalled();
  });

  it('alias-fail: propagates FailedToHandleAliasSettingsError, no channel reveal, no aggregator refresh', async () => {
    const loginWithAccessToken = jest.fn(() =>
      Effect.fail(new FailedToHandleAliasSettingsError({ message: 'alias clash' }))
    );
    const showChannel = jest.fn();
    const exit = await run({
      isProject: true,
      loginWithAccessToken,
      showChannel,
      gatherResult: Effect.succeed(PARAMS)
    });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('FailedToHandleAliasSettingsError');
    expect(showChannel).not.toHaveBeenCalled();
    expect(updateAggregators).not.toHaveBeenCalled();
  });

  it('precondition fail: getSfProject errors, gatherer not called', async () => {
    const loginWithAccessToken = jest.fn(() => Effect.succeed({}));
    const showChannel = jest.fn();
    const exit = await run({
      isProject: false,
      loginWithAccessToken,
      showChannel,
      gatherResult: Effect.succeed(PARAMS)
    });

    expect(Exit.isFailure(exit)).toBe(true);
    expect(gather).not.toHaveBeenCalled();
    expect(loginWithAccessToken).not.toHaveBeenCalled();
    expect(updateAggregators).not.toHaveBeenCalled();
  });
});
