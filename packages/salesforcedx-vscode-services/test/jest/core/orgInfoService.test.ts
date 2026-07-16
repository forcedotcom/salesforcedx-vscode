/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection, OrgConfigProperties, Org, type ConfigAggregator } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { AliasService } from '../../../src/core/alias';
import { ConfigService } from '../../../src/core/configService';
import { ConnectionService, UsernameConnectionNotSupportedOnWebError } from '../../../src/core/connectionService';
import { getDefaultOrgRef } from '../../../src/core/defaultOrgRef';
import { OrgInfoService } from '../../../src/core/orgInfoService';
import { SettingsService } from '../../../src/vscode/settingsService';

jest.mock('@salesforce/core', () => ({
  ...jest.requireActual('@salesforce/core'),
  AuthInfo: { create: jest.fn() },
  Connection: { create: jest.fn() },
  Org: { create: jest.fn() }
}));

const USERNAME = 'test@example.com';

const ORG_QUERY = {
  Id: '00D1234567890123',
  Name: 'Test Org',
  CreatedDate: '2024-01-01T00:00:00.000+0000',
  CreatedBy: { Username: 'admin@example.com' },
  OrganizationType: 'Enterprise'
};

const AUTH_FIELDS = {
  username: USERNAME,
  orgId: '00D1234567890123',
  accessToken: 'test-token',
  instanceUrl: 'https://test.salesforce.com',
  clientId: 'test-client-id'
};

type ConnParts = {
  fields?: Record<string, unknown>;
  identity?: jest.Mock;
  singleRecordQuery?: jest.Mock;
};

const makeConn = ({ fields = AUTH_FIELDS, identity, singleRecordQuery }: ConnParts = {}): Connection =>
  ({
    getAuthInfo: () => ({ getFields: () => fields }),
    getUsername: () => fields.username as string | undefined,
    singleRecordQuery: singleRecordQuery ?? jest.fn().mockResolvedValue(ORG_QUERY),
    identity: identity ?? jest.fn().mockResolvedValue({})
  }) as unknown as Connection;

// ---- mocked-ConnectionService layer (derivation + degrade-mapping tests) ----
type ServiceOpts = {
  getConnection?: (username?: string) => Effect.Effect<Connection, UsernameConnectionNotSupportedOnWebError>;
  aliases?: string[];
  configTargetOrg?: string;
  aliasToUsername?: Record<string, string>;
};

const mockConnectionService = (opts: ServiceOpts): Layer.Layer<ConnectionService> =>
  Layer.succeed(
    ConnectionService,
    ConnectionService.make({
      getConnection: (username?: string) =>
        (opts.getConnection ?? (() => Effect.succeed(makeConn())))(username),
      validateAccessTokenOrPromptReauth: () => Effect.void,
      invalidateCachedConnections: () => Effect.void,
      listAllAuthorizations: () => Effect.succeed([])
    } as unknown as ConnectionService)
  );

const mockAliasService = (opts: ServiceOpts): Layer.Layer<AliasService> =>
  Layer.succeed(
    AliasService,
    AliasService.make({
      getAllAliases: () => Effect.succeed({}),
      getAliasesFromUsername: () => Effect.succeed(opts.aliases ?? []),
      getUsernameFromAlias: (alias: string) => Effect.succeed(Option.fromNullable(opts.aliasToUsername?.[alias])),
      unsetAliases: () => Effect.void
    } as unknown as AliasService)
  );

const mockConfigService = (opts: ServiceOpts): Layer.Layer<ConfigService> =>
  Layer.succeed(
    ConfigService,
    ConfigService.make({
      getConfigAggregator: () => Effect.succeed({ getPropertyValue: () => opts.configTargetOrg } as never),
      invalidateConfigAggregator: () => Effect.void,
      getTargetOrg: () => Effect.succeed(opts.configTargetOrg),
      getTargetDevHub: () => Effect.succeed(undefined),
      isCurrentTargetOrg: () => Effect.succeed(false),
      isCurrentTargetDevHub: () => Effect.succeed(false),
      setTargetOrg: () => Effect.void,
      unsetTargetOrg: () => Effect.void,
      unsetTargetDevHub: () => Effect.void
    } as unknown as ConfigService)
  );

const buildLayer = (opts: ServiceOpts = {}) =>
  Layer.provide(
    OrgInfoService.DefaultWithoutDependencies,
    Layer.mergeAll(mockConnectionService(opts), mockAliasService(opts), mockConfigService(opts))
  );

const runOrgInfo = <A, E>(prog: Effect.Effect<A, E, OrgInfoService>, opts: ServiceOpts = {}) =>
  Effect.runPromiseExit(prog.pipe(Effect.provide(buildLayer(opts))));

describe('OrgInfoService.getOrgInfoForUsername', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AuthInfo.create).mockResolvedValue({ getFields: () => AUTH_FIELDS } as unknown as AuthInfo);
    jest.mocked(Org.create).mockResolvedValue({ getDevHubOrg: jest.fn() } as unknown as Org);
  });

  it('derives org info for an explicit username (non-scratch)', async () => {
    const exit = await runOrgInfo(OrgInfoService.getOrgInfoForUsername(USERNAME));
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toMatchObject({
        username: USERNAME,
        id: '00D1234567890123',
        createdBy: 'admin@example.com',
        edition: 'Enterprise',
        orgName: 'Test Org',
        accessToken: 'test-token',
        connectionStatus: 'Connected',
        status: 'Connected',
        aliases: []
      });
    }
  });

  it('falls back to the config target-org when no username is provided', async () => {
    const exit = await runOrgInfo(OrgInfoService.getOrgInfoForUsername(), { configTargetOrg: USERNAME });
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) expect(exit.value.username).toBe(USERNAME);
  });

  it('resolves a config alias to its username', async () => {
    const exit = await runOrgInfo(OrgInfoService.getOrgInfoForUsername(), {
      configTargetOrg: 'test-alias',
      aliasToUsername: { 'test-alias': USERNAME }
    });
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) expect(exit.value.username).toBe(USERNAME);
  });

  it('fails with NoUsernameError when nothing resolves', async () => {
    const exit = await runOrgInfo(OrgInfoService.getOrgInfoForUsername());
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('NoUsernameError');
  });

  it('supplements aliases from disk for the resolved username', async () => {
    const exit = await runOrgInfo(OrgInfoService.getOrgInfoForUsername(USERNAME), { aliases: ['alias1', 'alias2'] });
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) expect(exit.value.aliases).toEqual(['alias1', 'alias2']);
  });

  it('degrades to an error-status OrgInfo when the SOQL query fails (typed catch, not a die)', async () => {
    const queryError = new Error('Error authenticating with the refresh token due to: expired access/refresh token');
    const conn = makeConn({ singleRecordQuery: jest.fn().mockRejectedValue(queryError) });
    const exit = await runOrgInfo(OrgInfoService.getOrgInfoForUsername(USERNAME), {
      getConnection: () => Effect.succeed(conn)
    });
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.username).toBe(USERNAME);
      expect(exit.value.connectionStatus).toBe('Unable to refresh session: expired access/refresh token');
      // AuthInfo creation succeeded in buildErrorOrgInfo, so degraded info still carries auth fields
      expect(exit.value.accessToken).toBe('test-token');
    }
  });

  it('degrades gracefully when getConnection fails with UsernameConnectionNotSupportedOnWebError (web)', async () => {
    const exit = await runOrgInfo(OrgInfoService.getOrgInfoForUsername(USERNAME), {
      getConnection: () =>
        new UsernameConnectionNotSupportedOnWebError({ message: 'not supported on web' }) as unknown as Effect.Effect<
          Connection,
          UsernameConnectionNotSupportedOnWebError
        >
    });
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      // degraded via buildErrorOrgInfo on the bare username — no fromKey mis-parse
      expect(exit.value.username).toBe(USERNAME);
      expect(exit.value.connectionStatus).toBe('not supported on web');
    }
  });

  it('detects a scratch org via the dev hub query', async () => {
    const scratchFields = { ...AUTH_FIELDS, devHubUsername: 'devhub@example.com' };
    const conn = makeConn({ fields: scratchFields });
    jest.mocked(Org.create).mockResolvedValue({
      getDevHubOrg: jest.fn().mockResolvedValue({
        getConnection: jest.fn().mockReturnValue({
          singleRecordQuery: jest.fn().mockResolvedValue({
            Status: 'Active',
            CreatedBy: { Username: 'admin@example.com' },
            CreatedDate: '2024-01-01T00:00:00.000+0000',
            ExpirationDate: '2024-12-31T00:00:00.000+0000',
            Edition: 'Developer',
            OrgName: 'Test Scratch Org'
          })
        })
      })
    } as unknown as Org);

    const exit = await runOrgInfo(OrgInfoService.getOrgInfoForUsername(USERNAME), {
      getConnection: () => Effect.succeed(conn)
    });
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.devHubId).toBe('devhub@example.com');
      expect(exit.value.edition).toBe('Developer');
      expect(exit.value.status).toBe('Active');
      expect(exit.value.expirationDate).toBe('2024-12-31T00:00:00.000+0000');
    }
  });

  it('maps a sandbox org (IsSandbox: true) to edition Sandbox', async () => {
    const conn = makeConn({
      singleRecordQuery: jest.fn().mockResolvedValue({ ...ORG_QUERY, IsSandbox: true })
    });
    const exit = await runOrgInfo(OrgInfoService.getOrgInfoForUsername(USERNAME), {
      getConnection: () => Effect.succeed(conn)
    });
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) expect(exit.value.edition).toBe('Sandbox');
  });
});

describe('OrgInfoService.getOrgInfoFromConnection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AuthInfo.create).mockResolvedValue({ getFields: () => AUTH_FIELDS } as unknown as AuthInfo);
    jest.mocked(Org.create).mockResolvedValue({ getDevHubOrg: jest.fn() } as unknown as Org);
  });

  it('derives OrgInfo from an already-established connection (default path)', async () => {
    const conn = makeConn();
    const exit = await runOrgInfo(OrgInfoService.getOrgInfoFromConnection(conn));
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.username).toBe(USERNAME);
      expect(exit.value.connectionStatus).toBe('Connected');
      expect(exit.value.orgName).toBe('Test Org');
    }
  });

  it('degrades when the connection query fails', async () => {
    const conn = makeConn({
      singleRecordQuery: jest.fn().mockRejectedValue(new Error('no such org'))
    });
    const exit = await runOrgInfo(OrgInfoService.getOrgInfoFromConnection(conn));
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) expect(exit.value.connectionStatus).toBe(`Invalid org: ${USERNAME}`);
  });
});

// ---- real ConnectionService (defaultOrgRef regression + web typed-fail) ----
const authInfoCreateMock = jest.mocked(AuthInfo.create);
const connectionCreateMock = jest.mocked(Connection.create);
const getPropertyValueMock = jest.fn();
const getUsernameFromAliasMock = jest.fn();
const TARGET_ORG_KEY: string = OrgConfigProperties.TARGET_ORG;

// A desktop connection full enough for both getOrgInfoFromConnectionCore (SOQL/identity/getFields)
// and maybeUpdateDefaultOrgRef (getAuthInfoFields/query) to run without a real network call.
const makeRealDesktopConn = (username: string, getAuthInfoFieldsSpy?: jest.Mock): Connection =>
  ({
    getUsername: () => username,
    getAuthInfo: () => ({ isAccessTokenFlow: () => false, getFields: () => ({ username, orgId: '00Dxx' }) }),
    getAuthInfoFields:
      getAuthInfoFieldsSpy ??
      (() => ({ username, orgId: '00Dxx', tracksSource: false, isScratch: false, isSandbox: false })),
    getFields: () => ({ username }),
    singleRecordQuery: jest.fn().mockResolvedValue(ORG_QUERY),
    identity: jest.fn().mockResolvedValue({}),
    query: async () => ({ records: [], totalSize: 0 })
  }) as unknown as Connection;

const RealConfigServiceLayer = Layer.succeed(
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

const RealAliasServiceLayer = Layer.succeed(
  AliasService,
  AliasService.make({
    getAllAliases: () => Effect.succeed({}),
    getAliasesFromUsername: () => Effect.succeed([]),
    getUsernameFromAlias: (alias: string) => getUsernameFromAliasMock(alias),
    unsetAliases: () => Effect.void
  } as unknown as AliasService)
);

const RealSettingsServiceLayer = Layer.succeed(SettingsService, SettingsService.make({} as unknown as SettingsService));

const realConnectionLayer = Layer.provide(
  ConnectionService.DefaultWithoutDependencies,
  Layer.mergeAll(RealConfigServiceLayer, RealAliasServiceLayer, RealSettingsServiceLayer)
);

const realLayer = Layer.provide(
  OrgInfoService.DefaultWithoutDependencies,
  Layer.mergeAll(realConnectionLayer, RealAliasServiceLayer, RealConfigServiceLayer)
);

const runReal = <A, E>(prog: Effect.Effect<A, E, OrgInfoService>): Promise<Exit.Exit<A, E>> =>
  Effect.runPromiseExit(prog.pipe(Effect.provide(realLayer)));

describe('OrgInfoService defaultOrgRef regression (real ConnectionService)', () => {
  beforeEach(async () => {
    getPropertyValueMock.mockReset();
    getUsernameFromAliasMock.mockReset().mockReturnValue(Effect.succeed(Option.none()));
    authInfoCreateMock.mockReset().mockResolvedValue({ getFields: () => AUTH_FIELDS } as unknown as AuthInfo);
    connectionCreateMock.mockReset();
    jest.mocked(Org.create).mockReset().mockResolvedValue({ getDevHubOrg: jest.fn() } as unknown as Org);
    // reset shared default-org ref + drop module-scoped connection cache between tests
    await Effect.runPromise(getDefaultOrgRef().pipe(Effect.flatMap(ref => SubscriptionRef.set(ref, {}))));
    await Effect.runPromise(ConnectionService.invalidateCachedConnections().pipe(Effect.provide(realConnectionLayer)));
  });

  it('getOrgInfoForUsername(nonDefaultUsername) does NOT mutate defaultOrgRef', async () => {
    const getAuthInfoFieldsSpy = jest.fn(() => ({
      username: 'other@example.com',
      orgId: '00Dother',
      tracksSource: false,
      isScratch: false,
      isSandbox: false
    }));
    connectionCreateMock.mockResolvedValue(makeRealDesktopConn('other@example.com', getAuthInfoFieldsSpy));

    const before = await Effect.runPromise(
      getDefaultOrgRef().pipe(Effect.flatMap(ref => SubscriptionRef.get(ref)))
    );
    const exit = await runReal(OrgInfoService.getOrgInfoForUsername('other@example.com'));
    expect(Exit.isSuccess(exit)).toBe(true);

    // the ref-update fork (maybeUpdateDefaultOrgRef → getAuthInfoFields) must never run for an explicit username
    expect(getAuthInfoFieldsSpy).not.toHaveBeenCalled();
    const after = await Effect.runPromise(getDefaultOrgRef().pipe(Effect.flatMap(ref => SubscriptionRef.get(ref))));
    expect(after).toEqual(before);
    expect(after.orgId).toBeUndefined();
  });

  it('contrast: ConnectionService.getConnection() (no arg) DOES run the default-org ref-update fork', async () => {
    getPropertyValueMock.mockImplementation((prop: string) =>
      prop === TARGET_ORG_KEY ? 'default@example.com' : undefined
    );
    // maybeUpdateDefaultOrgRef (the only forked ref-update path) reads conn.getAuthInfoFields();
    // spying on it asserts the fork body ran deterministically (no setTimeout race, and no reliance
    // on the fork's later services which aren't provided in this mock layer).
    const getAuthInfoFieldsSpy = jest.fn(() => ({
      username: 'default@example.com',
      orgId: '00Dxx',
      tracksSource: false,
      isScratch: false,
      isSandbox: false
    }));
    connectionCreateMock.mockResolvedValue(makeRealDesktopConn('default@example.com', getAuthInfoFieldsSpy));

    // getConnection + a scheduler yield share one runtime so the forkDaemon body is scheduled before assert.
    // yieldNow (not a wall-clock sleep) is deterministic: getAuthInfoFields is the first sync statement in
    // maybeUpdateDefaultOrgRef, so the forked fiber runs up to that call on the yield — no timing race.
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* ConnectionService.getConnection();
        yield* Effect.yieldNow();
      }).pipe(Effect.provide(realConnectionLayer))
    );

    // no-arg path forks the ref update → getAuthInfoFields ran (contrast with the username test above,
    // where the fork is skipped by the `if (username === undefined)` guard so the spy is never called).
    expect(getAuthInfoFieldsSpy).toHaveBeenCalled();
  });

  it('web: getConnection(username) fails typed UsernameConnectionNotSupportedOnWebError', async () => {
    const prev = process.env.ESBUILD_PLATFORM;
    process.env.ESBUILD_PLATFORM = 'web';
    try {
      const exit = await Effect.runPromiseExit(
        ConnectionService.getConnection('someone@example.com').pipe(Effect.provide(realConnectionLayer))
      );
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('UsernameConnectionNotSupportedOnWebError');
    } finally {
      process.env.ESBUILD_PLATFORM = prev;
    }
  });
});
