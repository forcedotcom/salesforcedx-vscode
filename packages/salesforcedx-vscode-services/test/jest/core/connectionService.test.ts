/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Cause from 'effect/Cause';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { AliasService } from '../../../src/core/alias';
import { ConfigService } from '../../../src/core/configService';
import { ConnectionService } from '../../../src/core/connectionService';
import { ChannelService } from '../../../src/vscode/channelService';
import { SettingsService } from '../../../src/vscode/settingsService';

const USERNAME = 'expired@test.com';
const ALIAS = 'ExpiredOrg';
const INSTANCE_URL = 'https://expired.my.salesforce.com';
const LOGIN_BUTTON = 'Login';

const mockConfigService = (targetOrg: string | undefined = ALIAS): Layer.Layer<ConfigService> =>
  Layer.succeed(
    ConfigService,
    ConfigService.make({
      getConfigAggregator: () => Effect.succeed({ getPropertyValue: () => targetOrg } as never),
      invalidateConfigAggregator: () => Effect.void,
      getTargetOrg: () => Effect.succeed(targetOrg),
      getTargetDevHub: () => Effect.succeed(undefined),
      isCurrentTargetOrg: () => Effect.succeed(false),
      isCurrentTargetDevHub: () => Effect.succeed(false),
      unsetTargetOrg: () => Effect.void,
      unsetTargetDevHub: () => Effect.void,
      setTargetOrg: () => Effect.void
    })
  );

const mockSettingsService = (): Layer.Layer<SettingsService> =>
  Layer.succeed(SettingsService, SettingsService.make({} as never));

const mockAliasService = (aliases: string[]): Layer.Layer<AliasService> =>
  Layer.succeed(
    AliasService,
    AliasService.make({
      getAllAliases: () => Effect.succeed({}),
      getAliasesFromUsername: () => Effect.succeed(aliases),
      getUsernameFromAlias: () => Effect.succeed(undefined as never),
      unsetAliases: () => Effect.void
    })
  );

// Mock ChannelService directly rather than the real module-scoped OutputChannel cache (infinite TTL),
// which would leak the first test's channel object across the whole run.
const channelAppend = jest.fn();
const channelShowMock = jest.fn();
const mockChannelService = (): Layer.Layer<ChannelService> =>
  Layer.succeed(
    ChannelService,
    ChannelService.make({
      getChannel: Effect.succeed({} as never),
      showChannel: Effect.sync(() => channelShowMock()),
      clearChannel: Effect.void,
      appendToChannel: (message: string) => Effect.sync(() => channelAppend(message))
    })
  );

const buildLayer = (targetOrg: string | undefined = ALIAS) =>
  Layer.provide(
    ConnectionService.DefaultWithoutDependencies,
    Layer.mergeAll(mockConfigService(targetOrg), mockSettingsService(), mockAliasService([ALIAS]), mockChannelService())
  );

type ConnOverrides = {
  isAccessTokenFlow?: boolean;
  identity?: jest.Mock;
  username?: string;
};

const makeConn = ({ isAccessTokenFlow = true, identity, username = USERNAME }: ConnOverrides = {}): Connection =>
  ({
    getAuthInfo: () => ({ isAccessTokenFlow: () => isAccessTokenFlow }),
    getUsername: () => username,
    getAuthInfoFields: () => ({ username }),
    instanceUrl: INSTANCE_URL,
    identity: identity ?? jest.fn().mockResolvedValue({ user_id: '005' })
  }) as unknown as Connection;

describe('ConnectionService.validateAccessTokenOrPromptReauth', () => {
  let showErrorMessageSpy: jest.SpyInstance;
  let executeCommandSpy: jest.SpyInstance;

  beforeEach(() => {
    showErrorMessageSpy = jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined);
    executeCommandSpy = jest.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('skips (no identity call) when not access-token flow', async () => {
    const identity = jest.fn();
    const conn = makeConn({ isAccessTokenFlow: false, identity });

    await Effect.runPromise(
      ConnectionService.validateAccessTokenOrPromptReauth(conn).pipe(Effect.provide(buildLayer()))
    );

    expect(identity).not.toHaveBeenCalled();
    expect(showErrorMessageSpy).not.toHaveBeenCalled();
  });

  it('validates via identity() and does not prompt on success; caches (skips identity on second call)', async () => {
    const identity = jest.fn().mockResolvedValue({ user_id: '005' });
    const conn = makeConn({ identity });

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* ConnectionService.validateAccessTokenOrPromptReauth(conn);
        yield* ConnectionService.validateAccessTokenOrPromptReauth(conn);
      }).pipe(Effect.provide(buildLayer()))
    );

    expect(identity).toHaveBeenCalledTimes(1);
    expect(showErrorMessageSpy).not.toHaveBeenCalled();
  });

  it('on identity failure shows modal ONCE across N concurrent callers (Cache dedup) and dispatches sf.org.login.web', async () => {
    const identity = jest.fn().mockRejectedValue(new Error('token expired'));
    const conn = makeConn({ identity });
    showErrorMessageSpy.mockResolvedValue(LOGIN_BUTTON);

    const exit = await Effect.runPromiseExit(
      Effect.all(
        Array.from({ length: 5 }, () => ConnectionService.validateAccessTokenOrPromptReauth(conn)),
        { concurrency: 'unbounded' }
      ).pipe(Effect.provide(buildLayer()))
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(identity).toHaveBeenCalledTimes(1);
    expect(showErrorMessageSpy).toHaveBeenCalledTimes(1);
    // modal copy (relocated from utils): error + detail + Login button
    expect(showErrorMessageSpy).toHaveBeenCalledWith(
      'Access token expired or invalid.',
      { modal: true, detail: expect.stringContaining('reauthenticate') },
      LOGIN_BUTTON
    );
    expect(executeCommandSpy).toHaveBeenCalledWith('sf.org.login.web', INSTANCE_URL, ALIAS);
    // logs the reauth error to the channel and reveals it
    expect(channelAppend).toHaveBeenCalledWith(expect.stringContaining('Error refreshing access token'));
    expect(channelShowMock).toHaveBeenCalled();
  });

  it('falls back to username when no alias exists', async () => {
    const identity = jest.fn().mockRejectedValue(new Error('token expired'));
    const conn = makeConn({ identity });
    showErrorMessageSpy.mockResolvedValue(LOGIN_BUTTON);

    // target-org configured as the raw username (no alias) → dispatch falls back to the username
    await Effect.runPromiseExit(
      ConnectionService.validateAccessTokenOrPromptReauth(conn).pipe(Effect.provide(buildLayer(USERNAME)))
    );

    expect(executeCommandSpy).toHaveBeenCalledWith('sf.org.login.web', INSTANCE_URL, USERNAME);
  });

  it('does not dispatch login when modal dismissed, and fails with AccessTokenExpiredError', async () => {
    const identity = jest.fn().mockRejectedValue(new Error('token expired'));
    const conn = makeConn({ identity });
    showErrorMessageSpy.mockResolvedValue(undefined);

    const exit = await Effect.runPromiseExit(
      ConnectionService.validateAccessTokenOrPromptReauth(conn).pipe(Effect.provide(buildLayer()))
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(Cause.pretty(exit.cause)).toContain('AccessTokenExpiredError');
    expect(executeCommandSpy).not.toHaveBeenCalled();
  });

  it('does not re-nag: a still-cached failed Connection is not re-validated on the next call (one modal per session)', async () => {
    const identity = jest.fn().mockRejectedValue(new Error('token expired'));
    const conn = makeConn({ identity });
    showErrorMessageSpy.mockResolvedValue(undefined);

    await Effect.runPromiseExit(
      Effect.gen(function* () {
        yield* Effect.exit(ConnectionService.validateAccessTokenOrPromptReauth(conn));
        yield* Effect.sleep(Duration.millis(5));
        // same Connection object → cached failure retained → no re-validate, no repeat modal
        yield* Effect.exit(ConnectionService.validateAccessTokenOrPromptReauth(conn));
      }).pipe(Effect.provide(buildLayer()))
    );

    expect(identity).toHaveBeenCalledTimes(1);
    expect(showErrorMessageSpy).toHaveBeenCalledTimes(1);
  });
});
