/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Mock as VitestMock, MockInstance as VitestMockInstance } from 'vitest';
import { AuthInfo, Connection, OrgConfigProperties, type ConfigAggregator } from '@salesforce/core';
import * as Cause from 'effect/Cause';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import { isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as Schedule from 'effect/Schedule';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { AliasService } from '../../../src/core/alias';
import { ConfigService } from '../../../src/core/configService';
import {
  ConnectionService,
  InactiveOrgOperationError,
  NoTargetOrgConfiguredError,
  updateDefaultOrgIdentity
} from '../../../src/core/connectionService';
import { getDefaultOrgRef } from '../../../src/core/defaultOrgRef';
import { DefaultOrgInfoSchema } from '../../../src/core/schemas/defaultOrgInfo';
import { OrgId } from '../../../src/core/schemas/salesforceId';
import { preventOrgChanges } from '../../../src/core/targetOrgGuard';
import { SettingsService } from '../../../src/vscode/settingsService';

vi.mock('@salesforce/core', async () => ({
  ...(await vi.importActual<typeof import('@salesforce/core')>('@salesforce/core')),
  AuthInfo: { create: vi.fn() },
  Connection: { create: vi.fn() }
}));

const brandedOrgId = (value: string) => Schema.decodeSync(OrgId)(value);

const USERNAME = 'expired@test.com';
const ALIAS = 'ExpiredOrg';
const INSTANCE_URL = 'https://expired.my.salesforce.com';
const LOGIN_BUTTON = 'Login';

const mockConfigService = (targetOrg: string | undefined = ALIAS) =>
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

const mockSettingsService = () => Layer.succeed(SettingsService, SettingsService.make({} as never));

const mockAliasService = (aliases: string[]) =>
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
  identity?: VitestMock;
  username?: string;
  orgId?: string;
};

const makeConn = ({ isAccessTokenFlow = true, identity, username = USERNAME, orgId }: ConnOverrides = {}): Connection =>
  ({
    getAuthInfo: () => ({ isAccessTokenFlow: () => isAccessTokenFlow }),
    getUsername: () => username,
    getAuthInfoFields: () => ({ username, orgId }),
    instanceUrl: INSTANCE_URL,
    identity: identity ?? vi.fn().mockResolvedValue({ user_id: '005' })
  }) as unknown as Connection;

describe('ConnectionService.getConnectionForOrg', () => {
  beforeEach(async () => {
    await Effect.runPromise(ConnectionService.invalidateCachedConnections().pipe(Effect.provide(buildLayer())));
  });

  it('returns a connection whose org ID matches the captured operation org', async () => {
    const connection = makeConn({ isAccessTokenFlow: false, orgId: '00D000000000001' });
    vi.mocked(AuthInfo.create).mockResolvedValue({ getFields: () => ({}) } as unknown as AuthInfo);
    vi.mocked(Connection.create).mockResolvedValue(connection);

    await expect(
      Effect.runPromise(ConnectionService.getConnectionForOrg('00D000000000001').pipe(Effect.provide(buildLayer())))
    ).resolves.toBe(connection);
  });

  it('fails with the captured and observed org IDs when the target org changed', async () => {
    const connection = makeConn({ isAccessTokenFlow: false, orgId: '00D000000000002' });
    vi.mocked(AuthInfo.create).mockResolvedValue({ getFields: () => ({}) } as unknown as AuthInfo);
    vi.mocked(Connection.create).mockResolvedValue(connection);

    const exit = await Effect.runPromiseExit(
      ConnectionService.getConnectionForOrg('00D000000000001').pipe(Effect.provide(buildLayer()))
    );

    expect(exit).toEqual(
      Exit.fail(
        new InactiveOrgOperationError({
          message: "The active org changed while an operation for '00D000000000001' was in progress.",
          expectedOrgId: '00D000000000001',
          observedOrgId: '00D000000000002'
        })
      )
    );
  });
});

describe('preventOrgChanges', () => {
  const prepareConnection = async (orgId: string | undefined) => {
    await Effect.runPromise(ConnectionService.invalidateCachedConnections().pipe(Effect.provide(buildLayer())));
    await Effect.runPromise(getDefaultOrgRef().pipe(Effect.flatMap(ref => SubscriptionRef.set(ref, {}))));
    vi.mocked(AuthInfo.create).mockResolvedValue({ getFields: () => ({}) } as unknown as AuthInfo);
    vi.mocked(Connection.create).mockResolvedValue(makeConn({ isAccessTokenFlow: false, orgId }));
  };

  it('runs the command when the target org does not change', async () => {
    await prepareConnection('00D000000000003');

    await expect(
      Effect.runPromise(preventOrgChanges(Effect.succeed('complete')).pipe(Effect.provide(buildLayer())))
    ).resolves.toBe('complete');
  });

  it('keeps an observed target-org change cancelled after switching back', async () => {
    await prepareConnection('00D000000000003');

    const exit = await preventOrgChanges(
      Effect.gen(function* () {
        const ref = yield* getDefaultOrgRef();
        yield* SubscriptionRef.set(ref, { orgId: brandedOrgId('00D000000000004') });
        yield* SubscriptionRef.set(ref, { orgId: brandedOrgId('00D000000000003') });
        yield* Effect.sleep(Duration.millis(1));
      })
    ).pipe(Effect.provide(buildLayer()), Effect.runPromiseExit);

    expect(exit).toEqual(
      Exit.fail(
        new InactiveOrgOperationError({
          message: "The active org changed while an operation for '00D000000000003' was in progress.",
          expectedOrgId: '00D000000000003',
          observedOrgId: '00D000000000004'
        })
      )
    );
  });

  it('ignores target-org updates that retain the same org ID', async () => {
    await prepareConnection('00D000000000003');

    await expect(
      Effect.runPromise(
        preventOrgChanges(
          Effect.gen(function* () {
            yield* SubscriptionRef.set(yield* getDefaultOrgRef(), {
              orgId: brandedOrgId('00D000000000003'),
              username: 'replacement@example.com'
            });
            yield* Effect.sleep(Duration.millis(1));
            return 'complete';
          })
        ).pipe(Effect.provide(buildLayer()))
      )
    ).resolves.toBe('complete');
  });

  it('fails before the command when the connection has no org ID', async () => {
    await prepareConnection(undefined);

    const exit = await preventOrgChanges(Effect.succeed('not run')).pipe(
      Effect.provide(buildLayer()),
      Effect.runPromiseExit
    );

    expect(exit).toEqual(Exit.fail(new NoTargetOrgConfiguredError({ message: 'No target org configured' })));
  });
});

describe('ConnectionService.validateAccessTokenOrPromptReauth', () => {
  let showErrorMessageSpy: VitestMockInstance;
  let executeCommandSpy: VitestMockInstance;

  // runReauthLookup re-fetches the Connection via the module-scoped connectionCache (keyed by username),
  // so identity() is probed on whatever Connection.create yields — seed it with the mock conn under test.
  const seedConnectionCache = (conn: Connection) => {
    vi.mocked(AuthInfo.create).mockResolvedValue({ getFields: () => ({}) } as unknown as AuthInfo);
    vi.mocked(Connection.create).mockResolvedValue(conn);
  };

  beforeEach(async () => {
    showErrorMessageSpy = vi.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined);
    executeCommandSpy = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);
    // connectionCache is module-scoped (30min TTL, keyed by username) → drop it so each test seeds fresh.
    await Effect.runPromise(ConnectionService.invalidateCachedConnections().pipe(Effect.provide(buildLayer())));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('skips (no identity call) when not access-token flow', async () => {
    const identity = vi.fn();
    const conn = makeConn({ isAccessTokenFlow: false, identity });

    await Effect.runPromise(
      ConnectionService.validateAccessTokenOrPromptReauth(conn).pipe(Effect.provide(buildLayer()))
    );

    expect(identity).not.toHaveBeenCalled();
    expect(showErrorMessageSpy).not.toHaveBeenCalled();
  });

  it('validates via identity() and does not prompt on success; caches (skips identity on second call)', async () => {
    const identity = vi.fn().mockResolvedValue({ user_id: '005' });
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
    const identity = vi.fn().mockRejectedValue(new Error('token expired'));
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
    const identity = vi.fn().mockRejectedValue(new Error('token expired'));
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
    const identity = vi.fn().mockRejectedValue(new Error('token expired'));
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
    const identity = vi.fn().mockRejectedValue(new Error('token expired'));
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
    const identity = vi.fn().mockRejectedValue(new Error('token expired'));
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

const authInfoCreateMock = vi.mocked(AuthInfo.create);
const connectionCreateMock = vi.mocked(Connection.create);
// widen to string so getPropertyValue's `prop: string` compares without an unsafe-enum-comparison
const TARGET_ORG_KEY: string = OrgConfigProperties.TARGET_ORG;

// The desktop getConnection path reads target-org off the config aggregator; spy on it.
const getPropertyValueMock = vi.fn();
const getTargetOrgMock = vi.fn();
const getUsernameFromAliasMock = vi.fn();

// A connection whose getAuthInfoFields returns enough for maybeUpdateDefaultOrgRef to run without a network call.
// tracksSource is present so the ref-update path skips the Org.create-backed getTracksSourceFromOrg fallback.
const makeDesktopConn = (
  username: string,
  {
    orgId = '00D000000000005',
    query = async () => ({ records: [] as { Id: string; Username: string }[], totalSize: 0 })
  }: {
    orgId?: string;
    query?: (soql: string) => Promise<{ records: { Id: string; Username: string }[]; totalSize: number }>;
  } = {}
): Connection =>
  ({
    getUsername: () => username,
    getAuthInfoFields: () => ({
      username,
      orgId,
      instanceName: 'USA9S',
      tracksSource: false,
      isScratch: false,
      isSandbox: false
    }),
    getFields: () => ({ username }),
    getAuthInfo: () => ({ isAccessTokenFlow: () => false }),
    query
  }) as unknown as Connection;

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
    getAliasesFromUsername: () => Effect.succeed([]),
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

const waitUntil = (pred: () => boolean) =>
  Effect.runPromise(
    Effect.void.pipe(
      Effect.repeat({
        while: () => !pred(),
        schedule: Schedule.intersect(Schedule.spaced(Duration.millis(10)), Schedule.recurs(200))
      })
    )
  );

const defaultOrgWhen = (pred: (info: typeof DefaultOrgInfoSchema.Type) => boolean) =>
  getDefaultOrgRef().pipe(
    Effect.flatMap(ref => ref.changes.pipe(Stream.filter(pred), Stream.runHead, Effect.map(Option.getOrThrow))),
    Effect.timeout(Duration.seconds(2))
  );

const userRecord = (id: string, username: string) => ({ records: [{ Id: id, Username: username }], totalSize: 1 });

describe('updateDefaultOrgIdentity', () => {
  it('does not publish when the org identity is unchanged', async () => {
    const initial: typeof DefaultOrgInfoSchema.Type = {
      orgId: brandedOrgId('00D000000000005'),
      instanceName: 'USA9S',
      username: 'user@example.com'
    };
    const ref = Effect.runSync(SubscriptionRef.make(initial));

    const previousOrgId = await Effect.runPromise(
      updateDefaultOrgIdentity(ref, brandedOrgId('00D000000000005'), 'USA9S')
    );

    expect(previousOrgId).toBe('00D000000000005');
    expect(await Effect.runPromise(SubscriptionRef.get(ref))).toBe(initial);
  });

  it('publishes when the org identity changes', async () => {
    const initial: typeof DefaultOrgInfoSchema.Type = {
      orgId: brandedOrgId('00D000000000006'),
      instanceName: 'USA1',
      username: 'user@example.com'
    };
    const ref = Effect.runSync(SubscriptionRef.make(initial));

    const previousOrgId = await Effect.runPromise(
      updateDefaultOrgIdentity(ref, brandedOrgId('00D000000000007'), 'USA9S')
    );

    expect(previousOrgId).toBe('00D000000000006');
    expect(await Effect.runPromise(SubscriptionRef.get(ref))).toEqual({
      orgId: '00D000000000007',
      instanceName: 'USA9S',
      username: 'user@example.com'
    });
  });
});

describe('ConnectionService.getConnection (desktop)', () => {
  beforeEach(async () => {
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
    const getAuthInfoFieldsSpy = vi.fn(() => ({
      username: 'given@example.com',
      orgId: '00D000000000005',
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

    await run(ConnectionService.getConnection());

    expect(getPropertyValueMock).toHaveBeenCalledWith(OrgConfigProperties.TARGET_ORG);
    expect(authInfoCreateMock).toHaveBeenCalledWith({ username: 'default@example.com' });
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
          Stream.filter(info => info.username === USERNAME && info.orgId === '00D000000000005' && info.alias === ALIAS),
          Stream.runHead,
          Effect.map(Option.getOrThrow)
        );
      })
    );
    expect(orgInfo).toMatchObject({ username: USERNAME, alias: ALIAS, orgId: '00D000000000005' });
  });

  it('clears a cached alias when target-org is configured as the username', async () => {
    await Effect.runPromise(
      getDefaultOrgRef().pipe(
        Effect.flatMap(ref =>
          SubscriptionRef.set(ref, { username: USERNAME, alias: ALIAS, orgId: brandedOrgId('00D000000000005') })
        )
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
          Stream.filter(info => info.orgId === '00D000000000005' && isUndefined(info.alias)),
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
      orgId: '00D000000000005',
      instanceName: 'USA9S'
    });
  });

  it('no-arg path with no configured target-org fails with NoTargetOrgConfiguredError', async () => {
    getPropertyValueMock.mockReturnValue(undefined);

    const error = await run(ConnectionService.getConnection().pipe(Effect.flip));

    expect(error._tag).toBe('NoTargetOrgConfiguredError');
  });

  it('shares one User sObject query across concurrent default-org getConnection calls', async () => {
    getPropertyValueMock.mockImplementation((prop: string) => (prop === TARGET_ORG_KEY ? USERNAME : undefined));
    const gate = Promise.withResolvers<{ records: { Id: string; Username: string }[]; totalSize: number }>();
    const query = vi.fn().mockReturnValue(gate.promise);
    connectionCreateMock.mockResolvedValue({
      getUsername: () => USERNAME,
      getAuthInfoFields: () => ({
        username: USERNAME,
        orgId: '00D000000000005',
        instanceName: 'USA9S',
        tracksSource: false,
        isScratch: false,
        isSandbox: false
      }),
      getFields: () => ({ username: USERNAME }),
      getAuthInfo: () => ({ isAccessTokenFlow: () => false }),
      query
    } as unknown as Connection);

    const running = run(
      Effect.all([ConnectionService.getConnection(), ConnectionService.getConnection()], {
        concurrency: 'unbounded'
      })
    );

    await Effect.runPromise(
      Effect.void.pipe(
        Effect.repeat({
          while: () => query.mock.calls.length === 0,
          schedule: Schedule.intersect(Schedule.spaced(Duration.millis(10)), Schedule.recurs(200))
        })
      )
    );
    await Duration.millis(50).pipe(Effect.sleep, Effect.runPromise);
    expect(query).toHaveBeenCalledTimes(1);

    gate.resolve({ records: [{ Id: '005000000000001AAA', Username: USERNAME }], totalSize: 1 });
    await running;
  });

  it('loads the new User id when default-org username changes on the same orgId', async () => {
    const orgId = '00D0000000000AA';
    const userA = 'a@identity.test';
    const userB = 'b@identity.test';
    const userIdA = '00500000000000AAA';
    const userIdB = '00500000000000BAA';
    const queryA = vi.fn().mockResolvedValue(userRecord(userIdA, userA));
    const queryB = vi.fn().mockResolvedValue(userRecord(userIdB, userB));

    getPropertyValueMock.mockImplementation((prop: string) => (prop === TARGET_ORG_KEY ? userA : undefined));
    connectionCreateMock.mockResolvedValueOnce(makeDesktopConn(userA, { orgId, query: queryA }));

    const first = await run(
      Effect.gen(function* () {
        yield* ConnectionService.getConnection();
        return yield* defaultOrgWhen(info => info.userId === userIdA);
      })
    );
    expect(first).toMatchObject({ username: userA, userId: userIdA });

    await Effect.runPromise(getDefaultOrgRef().pipe(Effect.flatMap(ref => SubscriptionRef.set(ref, {}))));
    getPropertyValueMock.mockImplementation((prop: string) => (prop === TARGET_ORG_KEY ? userB : undefined));
    connectionCreateMock.mockResolvedValueOnce(makeDesktopConn(userB, { orgId, query: queryB }));

    const second = await run(
      Effect.gen(function* () {
        yield* ConnectionService.getConnection();
        return yield* defaultOrgWhen(info => info.userId === userIdB);
      })
    );
    expect(second).toMatchObject({ username: userB, userId: userIdB });
  });

  it('reuses cached User id after connection invalidate for the same username and orgId', async () => {
    const orgId = '00D0000000000CC';
    const username = 'c@identity.test';
    const cachedUserId = '00500000000000CAA';
    const queryFromDisk = vi.fn().mockResolvedValue(userRecord('00500000000000CZZ', username));
    const queryCached = vi.fn().mockResolvedValue(userRecord(cachedUserId, username));

    getPropertyValueMock.mockImplementation((prop: string) => (prop === TARGET_ORG_KEY ? username : undefined));
    connectionCreateMock.mockResolvedValueOnce(makeDesktopConn(username, { orgId, query: queryCached }));

    const first = await run(
      Effect.gen(function* () {
        yield* ConnectionService.getConnection();
        return yield* defaultOrgWhen(info => info.userId === cachedUserId);
      })
    );
    expect(first.userId).toBe(cachedUserId);

    await run(ConnectionService.invalidateCachedConnections());
    await Effect.runPromise(getDefaultOrgRef().pipe(Effect.flatMap(ref => SubscriptionRef.set(ref, {}))));
    connectionCreateMock.mockResolvedValueOnce(makeDesktopConn(username, { orgId, query: queryFromDisk }));

    const second = await run(
      Effect.gen(function* () {
        yield* ConnectionService.getConnection();
        return yield* defaultOrgWhen(info => info.userId !== undefined);
      })
    );
    expect(second).toMatchObject({ username, userId: cachedUserId });
    expect(queryFromDisk).not.toHaveBeenCalled();
  });

  it('does not apply an in-flight User lookup to a different username on the same orgId', async () => {
    const orgId = '00D0000000000EE';
    const userA = 'd@identity.test';
    const userB = 'e@identity.test';
    const userIdA = '00500000000000DAA';
    const userIdB = '00500000000000EAA';
    const gateA = Promise.withResolvers<{ records: { Id: string; Username: string }[]; totalSize: number }>();
    const queryA = vi.fn().mockReturnValue(gateA.promise);
    const queryB = vi.fn().mockResolvedValue(userRecord(userIdB, userB));

    getPropertyValueMock.mockImplementation((prop: string) => (prop === TARGET_ORG_KEY ? userA : undefined));
    connectionCreateMock.mockResolvedValueOnce(makeDesktopConn(userA, { orgId, query: queryA }));

    const runningA = run(ConnectionService.getConnection());
    await waitUntil(() => queryA.mock.calls.length > 0);

    await Effect.runPromise(getDefaultOrgRef().pipe(Effect.flatMap(ref => SubscriptionRef.set(ref, {}))));
    getPropertyValueMock.mockImplementation((prop: string) => (prop === TARGET_ORG_KEY ? userB : undefined));
    connectionCreateMock.mockResolvedValueOnce(makeDesktopConn(userB, { orgId, query: queryB }));

    const orgB = await run(
      Effect.gen(function* () {
        yield* ConnectionService.getConnection();
        return yield* defaultOrgWhen(info => info.userId === userIdB);
      })
    );
    expect(orgB).toMatchObject({ username: userB, userId: userIdB });

    gateA.resolve(userRecord(userIdA, userA));
    await runningA;
  });
});

describe('ConnectionService.getConnection (Web Console)', () => {
  const originalPlatform = process.env.ESBUILD_PLATFORM;

  afterAll(() => {
    if (isUndefined(originalPlatform)) delete process.env.ESBUILD_PLATFORM;
    else process.env.ESBUILD_PLATFORM = originalPlatform;
  });

  it('supplies the raw access token to AuthInfo.create and preserves cache hits', async () => {
    process.env.ESBUILD_PLATFORM = 'web';
    vi.resetModules();

    const { AuthInfo: WebAuthInfo, Connection: WebConnection } = await import('@salesforce/core');
    const WebEffect = await import('effect/Effect');
    const WebLayer = await import('effect/Layer');
    const Redacted = await import('effect/Redacted');
    const { AliasService: WebAliasService } = await import('../../../src/core/alias.js');
    const { ConfigService: WebConfigService } = await import('../../../src/core/configService.js');
    const { ConnectionService: WebConnectionService } = await import('../../../src/core/connectionService.js');
    const { SettingsService: WebSettingsService } = await import('../../../src/vscode/settingsService.js');
    const accessToken = 'web-console-token';
    const authInfo = { getFields: () => ({}), save: vi.fn().mockResolvedValue(undefined) } as unknown as AuthInfo;
    const connection = makeConn({ isAccessTokenFlow: false });
    vi.mocked(WebAuthInfo.create).mockResolvedValue(authInfo);
    vi.mocked(WebConnection.create).mockResolvedValue(connection);
    const dependencies = WebLayer.mergeAll(
      WebLayer.succeed(WebAliasService, WebAliasService.make({} as never)),
      WebLayer.succeed(WebConfigService, WebConfigService.make({} as never)),
      WebLayer.succeed(
        WebSettingsService,
        WebSettingsService.make({
          getInstanceUrl: () => WebEffect.succeed(INSTANCE_URL),
          getAccessToken: () => WebEffect.succeed(Redacted.make(accessToken)),
          getApiVersion: () => WebEffect.succeed('67.0')
        } as never)
      )
    );
    const layer = WebLayer.provide(WebConnectionService.DefaultWithoutDependencies, dependencies);

    await WebEffect.runPromise(WebConnectionService.getConnection('ignored').pipe(WebEffect.provide(layer)));
    await WebEffect.runPromise(WebConnectionService.getConnection('ignored').pipe(WebEffect.provide(layer)));

    expect(WebAuthInfo.create).toHaveBeenCalledWith({
      accessTokenOptions: { accessToken, loginUrl: INSTANCE_URL, instanceUrl: INSTANCE_URL }
    });
    expect(WebAuthInfo.create).toHaveBeenCalledTimes(1);
  });
});
