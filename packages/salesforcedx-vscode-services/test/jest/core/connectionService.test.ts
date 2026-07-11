/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection, OrgConfigProperties, type ConfigAggregator } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { AliasService } from '../../../src/core/alias';
import { ConfigService } from '../../../src/core/configService';
import { ConnectionService } from '../../../src/core/connectionService';
import { getDefaultOrgRef } from '../../../src/core/defaultOrgRef';
import { SettingsService } from '../../../src/vscode/settingsService';

jest.mock('@salesforce/core', () => ({
  ...jest.requireActual('@salesforce/core'),
  AuthInfo: { create: jest.fn() },
  Connection: { create: jest.fn() }
}));

const authInfoCreateMock = jest.mocked(AuthInfo.create);
const connectionCreateMock = jest.mocked(Connection.create);
// widen to string so getPropertyValue's `prop: string` compares without an unsafe-enum-comparison
const TARGET_ORG_KEY: string = OrgConfigProperties.TARGET_ORG;

// The desktop getConnection path reads target-org off the config aggregator; spy on it.
const getPropertyValueMock = jest.fn();
const getUsernameFromAliasMock = jest.fn();

// A connection whose getAuthInfoFields returns enough for maybeUpdateDefaultOrgRef to run without a network call.
// tracksSource is present so the ref-update path skips the Org.create-backed getTracksSourceFromOrg fallback.
const makeConn = (username: string): Connection =>
  ({
    getUsername: () => username,
    getAuthInfoFields: () => ({ username, orgId: '00Dxx', tracksSource: false, isScratch: false, isSandbox: false }),
    getFields: () => ({ username }),
    query: async () => ({ records: [], totalSize: 0 })
  }) as unknown as Connection;

const MockConfigServiceLayer = Layer.succeed(
  ConfigService,
  ConfigService.make({
    getConfigAggregator: () =>
      Effect.succeed({ getPropertyValue: getPropertyValueMock } as unknown as ConfigAggregator),
    invalidateConfigAggregator: () => Effect.void,
    getTargetOrg: () => Effect.succeed(undefined),
    getTargetDevHub: () => Effect.succeed(undefined),
    isCurrentTargetOrg: () => Effect.succeed(false),
    isCurrentTargetDevHub: () => Effect.succeed(false),
    setTargetOrg: () => Effect.void,
    unsetTargetOrg: () => Effect.void,
    unsetTargetDevHub: () => Effect.void
  } as unknown as ConfigService)
);

const MockAliasServiceLayer = Layer.succeed(
  AliasService,
  AliasService.make({
    getAllAliases: () => Effect.succeed({}),
    getAliasesFromUsername: () => Effect.succeed([]),
    getUsernameFromAlias: (alias: string) => getUsernameFromAliasMock(alias),
    unsetAliases: () => Effect.void
  } as unknown as AliasService)
);

const MockSettingsServiceLayer = Layer.succeed(SettingsService, SettingsService.make({} as unknown as SettingsService));

const serviceLayer = Layer.provide(
  ConnectionService.DefaultWithoutDependencies,
  Layer.mergeAll(MockConfigServiceLayer, MockAliasServiceLayer, MockSettingsServiceLayer)
);

const run = <A, E>(prog: Effect.Effect<A, E, ConnectionService>): Promise<A> =>
  Effect.runPromise(prog.pipe(Effect.provide(serviceLayer)));

describe('ConnectionService.getConnection (desktop)', () => {
  beforeEach(async () => {
    getPropertyValueMock.mockReset();
    getUsernameFromAliasMock.mockReset().mockReturnValue(Effect.succeed(Option.none()));
    authInfoCreateMock.mockReset().mockResolvedValue({ getFields: () => ({}) } as unknown as AuthInfo);
    connectionCreateMock.mockReset();
    // Reset the shared default-org ref so the no-arg path's ref update starts clean.
    await Effect.runPromise(getDefaultOrgRef().pipe(Effect.flatMap(ref => SubscriptionRef.set(ref, {}))));
    // Drop the module-scoped connection cache between tests (keyed by username).
    await run(ConnectionService.invalidateCachedConnections());
  });

  it('given a username, resolves that username and skips the config target-org lookup', async () => {
    connectionCreateMock.mockResolvedValue(makeConn('given@example.com'));

    const conn = await run(ConnectionService.getConnection('given@example.com'));

    expect(conn.getUsername()).toBe('given@example.com');
    // config target-org must NOT be consulted when a username is passed
    expect(getPropertyValueMock).not.toHaveBeenCalled();
    // the given value was alias-resolved (an alias lookup was attempted on it)
    expect(getUsernameFromAliasMock).toHaveBeenCalledWith('given@example.com');
    // AuthInfo built for the resolved username
    expect(authInfoCreateMock).toHaveBeenCalledWith({ username: 'given@example.com' });
  });

  it('given an alias, resolves it to the underlying username', async () => {
    getUsernameFromAliasMock.mockReturnValue(Effect.succeed(Option.some('real@example.com')));
    connectionCreateMock.mockResolvedValue(makeConn('real@example.com'));

    await run(ConnectionService.getConnection('myAlias'));

    expect(getUsernameFromAliasMock).toHaveBeenCalledWith('myAlias');
    expect(authInfoCreateMock).toHaveBeenCalledWith({ username: 'real@example.com' });
    expect(getPropertyValueMock).not.toHaveBeenCalled();
  });

  it('given a username, does NOT fork the default-org ref update', async () => {
    // maybeUpdateDefaultOrgRef (the only forked ref-update path) reads conn.getAuthInfoFields();
    // spying on it lets us assert the fork body never ran, deterministically (no setTimeout race).
    const getAuthInfoFieldsSpy = jest.fn(() => ({
      username: 'given@example.com',
      orgId: '00Dxx',
      tracksSource: false,
      isScratch: false,
      isSandbox: false
    }));
    connectionCreateMock.mockResolvedValue({
      getUsername: () => 'given@example.com',
      getAuthInfoFields: getAuthInfoFieldsSpy,
      getFields: () => ({ username: 'given@example.com' }),
      query: async () => ({ records: [], totalSize: 0 })
    } as unknown as Connection);

    await run(ConnectionService.getConnection('given@example.com'));

    expect(getAuthInfoFieldsSpy).not.toHaveBeenCalled();
    const orgInfo = await Effect.runPromise(getDefaultOrgRef().pipe(Effect.flatMap(ref => SubscriptionRef.get(ref))));
    expect(orgInfo.orgId).toBeUndefined();
  });

  it('no-arg path reads target-org from config', async () => {
    getPropertyValueMock.mockImplementation((prop: string) =>
      prop === TARGET_ORG_KEY ? 'default@example.com' : undefined
    );
    connectionCreateMock.mockResolvedValue(makeConn('default@example.com'));

    await run(ConnectionService.getConnection());

    expect(getPropertyValueMock).toHaveBeenCalledWith(OrgConfigProperties.TARGET_ORG);
    expect(authInfoCreateMock).toHaveBeenCalledWith({ username: 'default@example.com' });
  });

  it('no-arg path with no configured target-org fails with NoTargetOrgConfiguredError', async () => {
    getPropertyValueMock.mockReturnValue(undefined);

    const error = await run(ConnectionService.getConnection().pipe(Effect.flip));

    expect(error._tag).toBe('NoTargetOrgConfiguredError');
  });
});
