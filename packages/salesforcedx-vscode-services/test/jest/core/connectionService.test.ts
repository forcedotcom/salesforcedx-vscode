/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection, OrgConfigProperties, type ConfigAggregator } from '@salesforce/core';
import * as Cause from 'effect/Cause';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import { isUndefined } from 'effect/Predicate';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import * as Schema from 'effect/Schema';
import { AliasService } from '../../../src/core/alias';
import { ConfigService } from '../../../src/core/configService';
import {
  ConnectionService,
  InactiveOrgOperationError,
  updateDefaultOrgIdentity
} from '../../../src/core/connectionService';
import { getDefaultOrgRef } from '../../../src/core/defaultOrgRef';
import { DefaultOrgInfoSchema } from '../../../src/core/schemas/defaultOrgInfo';
import { SettingsService } from '../../../src/vscode/settingsService';
import { CliId } from '../../../src/observability/cliTelemetry';

jest.mock('@salesforce/core', () => ({
  ...jest.requireActual('@salesforce/core'),
  AuthInfo: { create: jest.fn() },
  Connection: { create: jest.fn() }
}));

const USERNAME = 'expired@test.com';
const ALIAS = 'ExpiredOrg';
const INSTANCE_URL = 'https://expired.my.salesforce.com';
const LOGIN_BUTTON = 'Login';

const ORG_A_USERNAME = 'org-a@example.com';
const ORG_B_USERNAME = 'org-b@example.com';
const ORG_A_ID = '00D00000000000A';
const ORG_B_ID = '00D00000000000B';
const makeDeferred = <A>() => Promise.withResolvers<A>();
const TEST_CLI_ID = Schema.decodeSync(CliId)('123e4567-e89b-42d3-a456-426614174000');

const mockConfigService = (targetOrg: string | undefined = ALIAS): Layer.Layer<ConfigService> =>
  Layer.succeed(
    ConfigService,
    ConfigService.make({
      getConfigAggregator: () => Effect.succeed({ getPropertyValue: () => targetOrg } as never),
      invalidateConfigAggregator: () => Effect.void,
      getTargetOrg: () => Effect.succeed(targetOrg),
      getTargetDevHub: () => Effect.succeed(undefined),
      isCliTelemetryDisabled: () => Effect.succeed(false),
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
      getUsernameFromAlias: () => Effect.succeed(Option.none()),
      unsetAliases: () => Effect.void
    })
  );

const buildLayer = (targetOrg: string | undefined = ALIAS) =>
  Layer.provide(
    ConnectionService.DefaultWithoutDependencies,
    Layer.mergeAll(mockConfigService(targetOrg), mockSettingsService(), mockAliasService([ALIAS]))
  );

type ConnOverrides = {
  isAccessTokenFlow?: boolean;
  identity?: jest.Mock;
  username?: string;
  orgId?: string;
};

const makeConn = ({ isAccessTokenFlow = true, identity, username = USERNAME, orgId }: ConnOverrides = {}): Connection =>
  ({
    getAuthInfo: () => ({ isAccessTokenFlow: () => isAccessTokenFlow }),
    getUsername: () => username,
    getAuthInfoFields: () => ({ username, orgId }),
    instanceUrl: INSTANCE_URL,
    identity: identity ?? jest.fn().mockResolvedValue({ user_id: '005' })
  }) as unknown as Connection;

describe('ConnectionService.getConnectionForOrg', () => {
  beforeEach(async () => {
    await Effect.runPromise(ConnectionService.invalidateCachedConnections().pipe(Effect.provide(buildLayer())));
  });

  it('returns a connection whose org ID matches the captured operation org', async () => {
    const connection = makeConn({ isAccessTokenFlow: false, orgId: '00D-expected' });
    jest.mocked(AuthInfo.create).mockResolvedValue({ getFields: () => ({}) } as unknown as AuthInfo);
    jest.mocked(Connection.create).mockResolvedValue(connection);

    await expect(
      Effect.runPromise(ConnectionService.getConnectionForOrg('00D-expected').pipe(Effect.provide(buildLayer())))
    ).resolves.toBe(connection);
  });

  it('fails with the captured and observed org IDs when the target org changed', async () => {
    const connection = makeConn({ isAccessTokenFlow: false, orgId: '00D-observed' });
    jest.mocked(AuthInfo.create).mockResolvedValue({ getFields: () => ({}) } as unknown as AuthInfo);
    jest.mocked(Connection.create).mockResolvedValue(connection);

    const exit = await Effect.runPromiseExit(
      ConnectionService.getConnectionForOrg('00D-expected').pipe(Effect.provide(buildLayer()))
    );

    expect(exit).toEqual(
      Exit.fail(
        new InactiveOrgOperationError({
          message: "The active org changed while an operation for '00D-expected' was in progress",
          expectedOrgId: '00D-expected',
          observedOrgId: '00D-observed'
        })
      )
    );
  });
});

describe('ConnectionService.validateAccessTokenOrPromptReauth', () => {
  let showErrorMessageSpy: jest.SpyInstance;
  let executeCommandSpy: jest.SpyInstance;

  // runReauthLookup re-fetches the Connection via the module-scoped connectionCache (keyed by username),
  // so identity() is probed on whatever Connection.create yields — seed it with the mock conn under test.
  const seedConnectionCache = (conn: Connection) => {
    jest.mocked(AuthInfo.create).mockResolvedValue({ getFields: () => ({}) } as unknown as AuthInfo);
    jest.mocked(Connection.create).mockResolvedValue(conn);
  };

  beforeEach(async () => {
    showErrorMessageSpy = jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined);
    executeCommandSpy = jest.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);
    // connectionCache is module-scoped (30min TTL, keyed by username) → drop it so each test seeds fresh.
    await Effect.runPromise(ConnectionService.invalidateCachedConnections().pipe(Effect.provide(buildLayer())));
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
    seedConnectionCache(conn);

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
    seedConnectionCache(conn);
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
  });

  it('falls back to username when no alias exists', async () => {
    const identity = jest.fn().mockRejectedValue(new Error('token expired'));
    const conn = makeConn({ identity });
    seedConnectionCache(conn);
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
    seedConnectionCache(conn);
    showErrorMessageSpy.mockResolvedValue(undefined);

    const exit = await Effect.runPromiseExit(
      ConnectionService.validateAccessTokenOrPromptReauth(conn).pipe(Effect.provide(buildLayer()))
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(Cause.pretty(exit.cause)).toContain('AccessTokenExpiredError');
    expect(executeCommandSpy).not.toHaveBeenCalled();
  });

  it('does not re-nag: a still-cached failed username is not re-validated on the next call (one modal per session)', async () => {
    const identity = jest.fn().mockRejectedValue(new Error('token expired'));
    const conn = makeConn({ identity });
    seedConnectionCache(conn);
    showErrorMessageSpy.mockResolvedValue(undefined);

    await Effect.runPromiseExit(
      Effect.gen(function* () {
        yield* Effect.exit(ConnectionService.validateAccessTokenOrPromptReauth(conn));
        yield* Effect.sleep(Duration.millis(5));
        // same username → cached failure retained → no re-validate, no repeat modal
        yield* Effect.exit(ConnectionService.validateAccessTokenOrPromptReauth(conn));
      }).pipe(Effect.provide(buildLayer()))
    );

    expect(identity).toHaveBeenCalledTimes(1);
    expect(showErrorMessageSpy).toHaveBeenCalledTimes(1);
  });

  it('does not stack modals when the Connection object is rebuilt for the same username (config-change churn)', async () => {
    // Regression for the two-stacked-modals bug: connectionCache is invalidated on every config-file change,
    // so getConnection yields a NEW Connection object each time. A Connection-object-keyed reauth cache would
    // re-prompt per rebuild; username-keying dedupes to one modal.
    const identity = jest.fn().mockRejectedValue(new Error('token expired'));
    showErrorMessageSpy.mockResolvedValue(undefined);

    // three distinct Connection objects for the same username, each seeded fresh (mimics rebuild-per-invalidation)
    await Effect.runPromiseExit(
      Effect.forEach([0, 1, 2], () =>
        Effect.gen(function* () {
          seedConnectionCache(makeConn({ identity }));
          yield* Effect.exit(ConnectionService.validateAccessTokenOrPromptReauth(makeConn({ identity })));
        })
      ).pipe(Effect.provide(buildLayer()))
    );

    expect(showErrorMessageSpy).toHaveBeenCalledTimes(1);
  });
});

const authInfoCreateMock = jest.mocked(AuthInfo.create);
const connectionCreateMock = jest.mocked(Connection.create);
// widen to string so getPropertyValue's `prop: string` compares without an unsafe-enum-comparison
const TARGET_ORG_KEY: string = OrgConfigProperties.TARGET_ORG;

// The desktop getConnection path reads target-org off the config aggregator; spy on it.
const getPropertyValueMock = jest.fn();
const getTargetOrgMock = jest.fn();
const getUsernameFromAliasMock = jest.fn();

const getAliasesFromUsernameMock = jest.fn();

// A connection whose getAuthInfoFields returns enough for maybeUpdateDefaultOrgRef to run without a network call.
// tracksSource is present so the ref-update path skips the Org.create-backed getTracksSourceFromOrg fallback.
type DesktopConnectionOptions = {
  username: string;
  orgId?: string;
  instanceName?: string;
  query?: jest.Mock;
};

const makeDesktopConn = (value: string | DesktopConnectionOptions): Connection => {
  const options = typeof value === 'string' ? { username: value } : value;
  const {
    username,
    orgId = '00Dxx',
    instanceName = 'USA9S',
    query = jest.fn().mockResolvedValue({ records: [], totalSize: 0 })
  } = options;

  return {
    getUsername: () => username,
    getAuthInfoFields: () => ({
      username,
      orgId,
      instanceName,
      tracksSource: false,
      isScratch: false,
      isSandbox: false
    }),
    getFields: () => ({ username }),
    getAuthInfo: () => ({ isAccessTokenFlow: () => false }),
    query
  } as unknown as Connection;
};

const MockConfigServiceLayer = Layer.succeed(
  ConfigService,
  ConfigService.make({
    getConfigAggregator: () =>
      Effect.succeed({ getPropertyValue: getPropertyValueMock } as unknown as ConfigAggregator),
    invalidateConfigAggregator: () => Effect.void,
    getTargetOrg: () => Effect.succeed(getTargetOrgMock()),
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
    getAliasesFromUsername: (username: string) => getAliasesFromUsernameMock(username),
    getUsernameFromAlias: (alias: string) => getUsernameFromAliasMock(alias),
    unsetAliases: () => Effect.void
  } as unknown as AliasService)
);

const MockSettingsServiceLayer = Layer.succeed(SettingsService, SettingsService.make({} as unknown as SettingsService));

const serviceLayer = ConnectionService.DefaultWithoutDependencies.pipe(
  Layer.provideMerge(Layer.mergeAll(MockConfigServiceLayer, MockAliasServiceLayer, MockSettingsServiceLayer))
);

const run = <A, E>(prog: Effect.Effect<A, E, ConnectionService>): Promise<A> =>
  Effect.runPromise(prog.pipe(Effect.provide(serviceLayer)));

describe('updateDefaultOrgIdentity', () => {
  it('does not publish when the org identity is unchanged', async () => {
    const initial: typeof DefaultOrgInfoSchema.Type = {
      orgId: '00Dxx',
      instanceName: 'USA9S',
      username: 'user@example.com'
    };
    const ref = Effect.runSync(SubscriptionRef.make(initial));

    const previousOrgId = await Effect.runPromise(updateDefaultOrgIdentity(ref, '00Dxx', 'USA9S'));

    expect(previousOrgId).toBe('00Dxx');
    expect(await Effect.runPromise(SubscriptionRef.get(ref))).toBe(initial);
  });

  it('publishes when the org identity changes', async () => {
    const initial: typeof DefaultOrgInfoSchema.Type = {
      orgId: '00Dold',
      instanceName: 'USA1',
      username: 'user@example.com'
    };
    const ref = Effect.runSync(SubscriptionRef.make(initial));

    const previousOrgId = await Effect.runPromise(updateDefaultOrgIdentity(ref, '00Dnew', 'USA9S'));

    expect(previousOrgId).toBe('00Dold');
    expect(await Effect.runPromise(SubscriptionRef.get(ref))).toEqual({
      orgId: '00Dnew',
      instanceName: 'USA9S',
      username: 'user@example.com'
    });
  });
});

describe('ConnectionService.getConnection (desktop)', () => {
  beforeEach(async () => {
    getAliasesFromUsernameMock.mockReset().mockReturnValue(Effect.succeed([]));
    getPropertyValueMock.mockReset();
    getTargetOrgMock.mockReset().mockReturnValue(undefined);
    getUsernameFromAliasMock.mockReset().mockReturnValue(Effect.succeed(Option.none()));
    authInfoCreateMock.mockReset().mockResolvedValue({ getFields: () => ({}) } as unknown as AuthInfo);
    connectionCreateMock.mockReset();
    // Reset the shared default-org ref so the no-arg path's ref update starts clean.
    await Effect.runPromise(getDefaultOrgRef().pipe(Effect.flatMap(ref => SubscriptionRef.set(ref, {}))));
    // Drop the module-scoped connection cache between tests (keyed by username).
    await run(ConnectionService.invalidateCachedConnections());
  });

  it('given a username, resolves that username and skips the config target-org lookup', async () => {
    connectionCreateMock.mockResolvedValue(makeDesktopConn('given@example.com'));

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
    connectionCreateMock.mockResolvedValue(makeDesktopConn('real@example.com'));

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
      getAuthInfo: () => ({ isAccessTokenFlow: () => false }),
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
    connectionCreateMock.mockResolvedValue(makeDesktopConn('default@example.com'));

    const ref = await Effect.runPromise(getDefaultOrgRef());
    const enrichmentCompleted = Effect.runPromise(
      ref.changes.pipe(
        Stream.filter(info => info.username === 'default@example.com'),
        Stream.runHead,
        Effect.map(Option.getOrThrow)
      )
    );

    await run(ConnectionService.getConnection());
    await enrichmentCompleted;

    expect(getPropertyValueMock).toHaveBeenCalledWith(OrgConfigProperties.TARGET_ORG);
    expect(authInfoCreateMock).toHaveBeenCalledWith({
      username: 'default@example.com'
    });
  });

  it('caches the configured alias with the resolved default-org identity', async () => {
    getPropertyValueMock.mockImplementation((prop: string) => (prop === TARGET_ORG_KEY ? ALIAS : undefined));
    getTargetOrgMock.mockReturnValue(ALIAS);
    getUsernameFromAliasMock.mockReturnValue(Effect.succeed(Option.some(USERNAME)));
    connectionCreateMock.mockResolvedValue(makeDesktopConn(USERNAME));

    const orgInfo = await run(
      Effect.gen(function* () {
        const ref = yield* getDefaultOrgRef();
        yield* ConnectionService.getConnection();
        return yield* ref.changes.pipe(
          Stream.filter(info => info.orgId === '00Dxx' && info.alias === ALIAS),
          Stream.runHead,
          Effect.map(Option.getOrThrow)
        );
      })
    );
    expect(orgInfo).toMatchObject({ username: USERNAME, alias: ALIAS, orgId: '00Dxx' });
  });

  it('clears a cached alias when target-org is configured as the username', async () => {
    await Effect.runPromise(
      getDefaultOrgRef().pipe(
        Effect.flatMap(ref => SubscriptionRef.set(ref, { username: USERNAME, alias: ALIAS, orgId: '00Dxx' }))
      )
    );
    getPropertyValueMock.mockImplementation((prop: string) => (prop === TARGET_ORG_KEY ? USERNAME : undefined));
    getTargetOrgMock.mockReturnValue(USERNAME);
    connectionCreateMock.mockResolvedValue(makeDesktopConn(USERNAME));

    const orgInfo = await run(
      Effect.gen(function* () {
        const ref = yield* getDefaultOrgRef();
        yield* ConnectionService.getConnection();
        return yield* ref.changes.pipe(
          Stream.filter(info => info.orgId === '00Dxx' && isUndefined(info.alias)),
          Stream.runHead,
          Effect.map(Option.getOrThrow)
        );
      })
    );
    expect(orgInfo.alias).toBeUndefined();
  });

  it('no-arg path captures AuthInfo orgId and instanceName', async () => {
    getPropertyValueMock.mockReturnValue('default@example.com');
    connectionCreateMock.mockResolvedValue(makeDesktopConn('default@example.com'));

    await run(ConnectionService.getConnection());
    expect(await Effect.runPromise(getDefaultOrgRef().pipe(Effect.flatMap(SubscriptionRef.get)))).toMatchObject({
      orgId: '00Dxx',
      instanceName: 'USA9S'
    });
  });

  it('no-arg path with no configured target-org fails with NoTargetOrgConfiguredError', async () => {
    getPropertyValueMock.mockReturnValue(undefined);

    const error = await run(ConnectionService.getConnection().pipe(Effect.flip));

    expect(error._tag).toBe('NoTargetOrgConfiguredError');
  });

  it('keeps the newer org B state when the older org A enrichment finishes last', async () => {
    let configuredTarget = ORG_A_USERNAME;

    getPropertyValueMock.mockImplementation((property: string) =>
      property === TARGET_ORG_KEY ? configuredTarget : undefined
    );
    getTargetOrgMock.mockImplementation(() => configuredTarget);
    getUsernameFromAliasMock.mockReturnValue(Effect.succeed(Option.none()));

    const aQueryStarted = makeDeferred<void>();
    const aQueryResult = makeDeferred<{
      records: Array<{ Id: string; Username: string }>;
      totalSize: number;
    }>();
    const aReachedFinalLookup = makeDeferred<void>();

    const connectionA = makeDesktopConn({
      username: ORG_A_USERNAME,
      orgId: ORG_A_ID,
      instanceName: 'ORG-A',
      query: jest.fn(async () => {
        aQueryStarted.resolve(undefined);
        return aQueryResult.promise;
      })
    });

    const connectionB = makeDesktopConn({
      username: ORG_B_USERNAME,
      orgId: ORG_B_ID,
      instanceName: 'ORG-B',
      query: jest.fn().mockResolvedValue({
        records: [{ Id: '00500000000000B', Username: ORG_B_USERNAME }],
        totalSize: 1
      })
    });

    const authInfoA = {
      getFields: () => ({ username: ORG_A_USERNAME })
    } as unknown as AuthInfo;

    const authInfoB = {
      getFields: () => ({ username: ORG_B_USERNAME })
    } as unknown as AuthInfo;

    authInfoCreateMock.mockResolvedValueOnce(authInfoA).mockResolvedValueOnce(authInfoB);

    connectionCreateMock.mockResolvedValueOnce(connectionA).mockResolvedValueOnce(connectionB);

    getAliasesFromUsernameMock.mockImplementation((username: string) =>
      Effect.sync(() => {
        if (username === ORG_A_USERNAME) {
          aReachedFinalLookup.resolve(undefined);
        }
        return [];
      })
    );

    const ref = await Effect.runPromise(getDefaultOrgRef());

    await Effect.runPromise(
      SubscriptionRef.set(ref, {
        cliId: TEST_CLI_ID
      })
    );

    // Start A. getConnection() returns after starting its detached enrichment,
    // while A's User query remains blocked by aQueryResult.
    await run(ConnectionService.getConnection());
    await aQueryStarted.promise;

    expect(await Effect.runPromise(SubscriptionRef.get(ref))).toMatchObject({
      orgId: ORG_A_ID
    });

    // Switch the configured target to B while A enrichment is still blocked.
    configuredTarget = ORG_B_USERNAME;

    const completeB = Effect.runPromise(
      ref.changes.pipe(
        Stream.filter(orgInfo => orgInfo.orgId === ORG_B_ID && orgInfo.username === ORG_B_USERNAME),
        Stream.runHead,
        Effect.map(Option.getOrThrow)
      )
    );

    await run(ConnectionService.getConnection());
    await completeB;

    expect(await Effect.runPromise(SubscriptionRef.get(ref))).toMatchObject({
      orgId: ORG_B_ID,
      username: ORG_B_USERNAME,
      instanceName: 'ORG-B'
    });

    // Let the older A lookup complete only after B has fully committed.
    aQueryResult.resolve({
      records: [{ Id: '00500000000000A', Username: ORG_A_USERNAME }],
      totalSize: 1
    });

    await aReachedFinalLookup.promise;

    // Drain the detached Effect fiber after its final mocked lookup.
    await new Promise<void>(resolve => setImmediate(resolve));

    const finalOrgInfo = await ref.pipe(SubscriptionRef.get, Effect.runPromise);

    expect(finalOrgInfo).toMatchObject({
      orgId: ORG_B_ID,
      username: ORG_B_USERNAME,
      instanceName: 'ORG-B',
      tracksSource: false
    });
    expect(finalOrgInfo.alias).toBeUndefined();
  });
});
