/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection, Org } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { AliasService } from '../../../src/core/alias';
import { ConfigService } from '../../../src/core/configService';
import { ConnectionService } from '../../../src/core/connectionService';
import { clearDefaultOrgRef, getDefaultOrgRef } from '../../../src/core/defaultOrgRef';
import { OrgInfoService } from '../../../src/core/orgInfoService';
import { ChannelService } from '../../../src/vscode/channelService';
import { SettingsService } from '../../../src/vscode/settingsService';

jest.mock('@salesforce/core', () => ({
  ...jest.requireActual('@salesforce/core'),
  AuthInfo: { create: jest.fn() },
  Connection: { create: jest.fn() },
  Org: { create: jest.fn() }
}));

type OrgQueryRow = {
  Id: string;
  Name: string;
  CreatedDate: string;
  CreatedBy: { Username: string };
  OrganizationType: string;
  InstanceName?: string;
  IsSandbox?: boolean;
  NamespacePrefix?: string;
};

const DEFAULT_AUTH_FIELDS = {
  username: 'test@example.com',
  orgId: '00D1234567890123',
  accessToken: 'test-token',
  instanceUrl: 'https://test.salesforce.com',
  clientId: 'test-client-id'
};

const ORG_QUERY: OrgQueryRow = {
  Id: '00D1234567890123',
  Name: 'Test Org',
  CreatedDate: '2024-01-01T00:00:00.000+0000',
  CreatedBy: { Username: 'admin@example.com' },
  OrganizationType: 'Enterprise'
};

type BuildConnOpts = {
  authFields?: Record<string, unknown>;
  orgQuery?: OrgQueryRow;
  identity?: () => Promise<unknown>;
  singleRecordQuery?: jest.Mock;
};

const buildMockConnection = (opts: BuildConnOpts = {}): Connection => {
  const authFields = opts.authFields ?? DEFAULT_AUTH_FIELDS;
  return {
    getAuthInfo: () => ({ getFields: () => authFields, isAccessTokenFlow: () => false }),
    getUsername: () => authFields.username,
    getAuthInfoFields: () => authFields,
    identity: opts.identity ?? jest.fn().mockResolvedValue({}),
    query: jest.fn().mockResolvedValue({ records: [], totalSize: 0 }),
    singleRecordQuery: opts.singleRecordQuery ?? jest.fn().mockResolvedValue(opts.orgQuery ?? ORG_QUERY)
  } as unknown as Connection;
};

/** OrgInfoService built on mocked ConnectionService/AliasService/ConfigService layers. */
const buildOrgInfoLayer = (opts: {
  connForUsername?: (username: string) => Effect.Effect<Connection, unknown>;
  aliases?: Record<string, string>;
  configTargetOrg?: string;
}) => {
  const aliases = opts.aliases ?? {};
  const connectionLayer = Layer.succeed(
    ConnectionService,
    ConnectionService.make({
      getConnection: () => Effect.succeed(buildMockConnection()),
      getConnectionForUsername: (opts.connForUsername ??
        ((username: string) => Effect.succeed(buildMockConnection({ authFields: { ...DEFAULT_AUTH_FIELDS, username } })))) as ConnectionService['getConnectionForUsername'],
      validateAccessTokenOrPromptReauth: () => Effect.void,
      invalidateCachedConnections: () => Effect.void,
      listAllAuthorizations: () => Effect.succeed([])
    })
  );
  const aliasLayer = Layer.succeed(
    AliasService,
    AliasService.make({
      getAllAliases: () => Effect.succeed(aliases),
      getAliasesFromUsername: (username: string) =>
        Effect.succeed(
          Object.entries(aliases)
            .filter(([, u]) => u === username)
            .map(([a]) => a)
        ),
      getUsernameFromAlias: (alias: string) => Effect.succeed(Option.fromNullable(aliases[alias])),
      unsetAliases: () => Effect.void
    })
  );
  const configLayer = Layer.succeed(ConfigService, {
    getTargetOrg: () => Effect.succeed(opts.configTargetOrg)
  } as unknown as ConfigService);

  return Layer.provide(
    OrgInfoService.DefaultWithoutDependencies,
    Layer.mergeAll(connectionLayer, aliasLayer, configLayer)
  );
};

const runOrgInfo = <A, E>(prog: Effect.Effect<A, E, OrgInfoService>, layer: Layer.Layer<OrgInfoService>) =>
  Effect.runPromiseExit(prog.pipe(Effect.provide(layer)));

describe('OrgInfoService.getOrgInfoForUsername', () => {
  beforeEach(() => {
    jest.mocked(AuthInfo.create).mockResolvedValue({ getFields: () => DEFAULT_AUTH_FIELDS } as unknown as AuthInfo);
    jest.mocked(Org.create).mockResolvedValue({ getDevHubOrg: jest.fn().mockResolvedValue(undefined) } as unknown as Org);
  });

  it('derives OrgInfo for a provided username', async () => {
    const layer = buildOrgInfoLayer({});
    const exit = await runOrgInfo(OrgInfoService.getOrgInfoForUsername('test@example.com'), layer);
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toMatchObject({
        username: 'test@example.com',
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

  it('falls back to the config target-org when no username provided', async () => {
    const layer = buildOrgInfoLayer({ configTargetOrg: 'test@example.com' });
    const exit = await runOrgInfo(OrgInfoService.getOrgInfoForUsername(), layer);
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) expect(exit.value.username).toBe('test@example.com');
  });

  it('resolves a config alias to its username', async () => {
    const layer = buildOrgInfoLayer({ aliases: { 'test-alias': 'test@example.com' }, configTargetOrg: 'test-alias' });
    const exit = await runOrgInfo(OrgInfoService.getOrgInfoForUsername(), layer);
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) expect(exit.value.username).toBe('test@example.com');
  });

  it('fails with NoUsernameError when nothing resolves', async () => {
    const layer = buildOrgInfoLayer({});
    const exit = await runOrgInfo(OrgInfoService.getOrgInfoForUsername(), layer);
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('NoUsernameError');
  });

  it('supplements aliases from disk for the resolved username', async () => {
    const layer = buildOrgInfoLayer({ aliases: { a1: 'test@example.com', a2: 'test@example.com' } });
    const exit = await runOrgInfo(OrgInfoService.getOrgInfoForUsername('test@example.com'), layer);
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) expect(exit.value.aliases).toEqual(['a1', 'a2']);
  });

  it('detects a scratch org via the dev hub query', async () => {
    const scratchAuthFields = { ...DEFAULT_AUTH_FIELDS, devHubUsername: 'devhub@example.com' };
    jest.mocked(Org.create).mockResolvedValue({
      getDevHubOrg: jest.fn().mockResolvedValue({
        getConnection: () => ({
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

    const layer = buildOrgInfoLayer({
      connForUsername: () => Effect.succeed(buildMockConnection({ authFields: scratchAuthFields }))
    });
    const exit = await runOrgInfo(OrgInfoService.getOrgInfoForUsername('test@example.com'), layer);
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.devHubId).toBe('devhub@example.com');
      expect(exit.value.edition).toBe('Developer');
      expect(exit.value.status).toBe('Active');
      expect(exit.value.expirationDate).toBe('2024-12-31T00:00:00.000+0000');
    }
  });

  it('maps a sandbox org (IsSandbox: true) to edition Sandbox', async () => {
    const layer = buildOrgInfoLayer({
      connForUsername: () =>
        Effect.succeed(buildMockConnection({ orgQuery: { ...ORG_QUERY, IsSandbox: true } }))
    });
    const exit = await runOrgInfo(OrgInfoService.getOrgInfoForUsername('test@example.com'), layer);
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) expect(exit.value.edition).toBe('Sandbox');
  });

  it('SOQL failure degrades to an error-status OrgInfo (typed catch, not a die)', async () => {
    const queryError = new Error('Error authenticating with the refresh token due to: expired access/refresh token');
    const layer = buildOrgInfoLayer({
      connForUsername: () =>
        Effect.succeed(buildMockConnection({ singleRecordQuery: jest.fn().mockRejectedValue(queryError) }))
    });
    const exit = await runOrgInfo(OrgInfoService.getOrgInfoForUsername('test@example.com'), layer);
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.username).toBe('test@example.com');
      expect(exit.value.connectionStatus).toBe('Unable to refresh session: expired access/refresh token');
      // AuthInfo.create succeeds in buildErrorOrgInfo, so auth fields still populate
      expect(exit.value.accessToken).toBe('test-token');
    }
  });

  it.each([
    ['System is down for maintenance', 'Down (Maintenance)'],
    ['<html><body>Gateway Timeout</body></html>', 'Bad Response'],
    ['no such org: test@example.com', 'Invalid org: test@example.com']
  ])('maps SOQL error %p to connection status %p', async (errMessage, expectedStatus) => {
    const layer = buildOrgInfoLayer({
      connForUsername: () =>
        Effect.succeed(buildMockConnection({ singleRecordQuery: jest.fn().mockRejectedValue(new Error(errMessage)) }))
    });
    const exit = await runOrgInfo(OrgInfoService.getOrgInfoForUsername('test@example.com'), layer);
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) expect(exit.value.connectionStatus).toBe(expectedStatus);
  });

  it('web: getConnectionForUsername failure degrades gracefully (no fromKey mis-parse)', async () => {
    // Simulate the web guard by having getConnectionForUsername fail with the typed web error.
    const layer = buildOrgInfoLayer({
      connForUsername: () =>
        Effect.fail({ _tag: 'UsernameConnectionNotSupportedOnWebError', message: 'not supported on web' })
    });
    const exit = await runOrgInfo(OrgInfoService.getOrgInfoForUsername('test@example.com'), layer);
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.username).toBe('test@example.com');
      expect(exit.value.connectionStatus).toBe('not supported on web');
    }
  });
});

describe('OrgInfoService.getOrgInfoFromConnection', () => {
  beforeEach(() => {
    jest.mocked(AuthInfo.create).mockResolvedValue({ getFields: () => DEFAULT_AUTH_FIELDS } as unknown as AuthInfo);
    jest.mocked(Org.create).mockResolvedValue({ getDevHubOrg: jest.fn().mockResolvedValue(undefined) } as unknown as Org);
  });

  it('derives OrgInfo from an established default-org connection', async () => {
    const layer = buildOrgInfoLayer({});
    const exit = await runOrgInfo(OrgInfoService.getOrgInfoFromConnection(buildMockConnection()), layer);
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.username).toBe('test@example.com');
      expect(exit.value.orgName).toBe('Test Org');
      expect(exit.value.connectionStatus).toBe('Connected');
    }
  });

  it('fails with NoUsernameError when the connection carries no username', async () => {
    const conn = buildMockConnection({ authFields: { ...DEFAULT_AUTH_FIELDS, username: undefined } });
    const layer = buildOrgInfoLayer({});
    const exit = await runOrgInfo(OrgInfoService.getOrgInfoFromConnection(conn), layer);
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('NoUsernameError');
  });

  it('SOQL failure degrades to an error-status OrgInfo (typed catch, not a die)', async () => {
    const queryError = new Error('Error authenticating with the refresh token due to: expired access/refresh token');
    const conn = buildMockConnection({ singleRecordQuery: jest.fn().mockRejectedValue(queryError) });
    const layer = buildOrgInfoLayer({});
    const exit = await runOrgInfo(OrgInfoService.getOrgInfoFromConnection(conn), layer);
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.username).toBe('test@example.com');
      expect(exit.value.connectionStatus).toBe('Unable to refresh session: expired access/refresh token');
    }
  });
});

// ConnectionService divergence: getConnectionForUsername must NOT touch the default-org ref, while
// getConnection DOES (via the forked maybeUpdateDefaultOrgRef). Build the real ConnectionService with
// mocked ConfigService/SettingsService/AliasService deps so both accessors run their real bodies.
describe('ConnectionService default-org ref side effect', () => {
  const ORIGINAL_PLATFORM = process.env.ESBUILD_PLATFORM;

  // getConnection's desktop branch reads the target org from ConfigService.getTargetOrg().
  const connDeps = Layer.mergeAll(
    Layer.succeed(ConfigService, { getTargetOrg: () => Effect.succeed('default@example.com') } as unknown as ConfigService),
    Layer.succeed(AliasService, {
      getUsernameFromAlias: () => Effect.succeed(Option.none()),
      getAliasesFromUsername: () => Effect.succeed([]),
      getAllAliases: () => Effect.succeed({}),
      unsetAliases: () => Effect.void
    } as unknown as AliasService),
    Layer.succeed(SettingsService, {} as unknown as SettingsService),
    Layer.succeed(
      ChannelService,
      ChannelService.make({
        getChannel: Effect.succeed({} as never),
        showChannel: Effect.void,
        clearChannel: Effect.void,
        appendToChannel: () => Effect.void
      })
    )
  );
  const connLayer = Layer.provide(ConnectionService.DefaultWithoutDependencies, connDeps);

  beforeEach(() => {
    process.env.ESBUILD_PLATFORM = ORIGINAL_PLATFORM;
    jest.mocked(AuthInfo.create).mockResolvedValue({ getFields: () => DEFAULT_AUTH_FIELDS } as unknown as AuthInfo);
    jest.mocked(Connection.create).mockResolvedValue(buildMockConnection());
    jest.mocked(Org.create).mockResolvedValue({
      getDevHubOrg: jest.fn().mockResolvedValue(undefined),
      tracksSource: jest.fn().mockResolvedValue(false)
    } as unknown as Org);
    // resetMocks wipes setup-jest's os.homedir mock impl; re-apply so Global.SFDX_DIR resolves for
    // the forked maybeUpdateDefaultOrgRef's AliasService.Default (join(homedir, .sfdx, alias.json)).
    jest.mocked(require('node:os').homedir).mockReturnValue('/tmp');
    // getConnection forks maybeUpdateDefaultOrgRef, which provides its own AliasService.Default and
    // reads alias.json off the (mocked) vscode fs. Return a valid empty alias file so the fork lands.
    const vscode = require('vscode');
    jest.mocked(vscode.workspace.fs.readFile).mockResolvedValue(Buffer.from(JSON.stringify({ orgs: {} })));
  });

  afterAll(() => {
    process.env.ESBUILD_PLATFORM = ORIGINAL_PLATFORM;
  });

  it('getConnectionForUsername does NOT mutate the default-org ref for a non-default username', async () => {
    const sentinel = { orgId: 'SENTINEL-ORG', username: 'default@example.com' };
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* clearDefaultOrgRef();
        const ref = yield* getDefaultOrgRef();
        yield* SubscriptionRef.set(ref, sentinel);
        yield* ConnectionService.getConnectionForUsername('other@example.com');
        // no forked ref update on this path — read is immediately safe/deterministic
        return yield* SubscriptionRef.get(ref);
      }).pipe(Effect.provide(connLayer))
    );
    expect(result).toEqual(sentinel);
  });

  it('getConnection DOES update the default-org ref (proves the divergence)', async () => {
    const after = await Effect.runPromise(
      Effect.gen(function* () {
        yield* clearDefaultOrgRef();
        const ref = yield* getDefaultOrgRef();
        yield* ConnectionService.getConnection();
        // the ref update is forked (maybeUpdateDefaultOrgRef); poll until it lands
        return yield* Effect.iterate(yield* SubscriptionRef.get(ref), {
          while: current => current.orgId !== '00D1234567890123',
          body: () => Effect.sleep('20 millis').pipe(Effect.andThen(SubscriptionRef.get(ref)))
        }).pipe(Effect.timeout('10 seconds'));
      }).pipe(Effect.provide(connLayer))
    );
    expect(after.orgId).toBe('00D1234567890123');
  }, 15_000);

  it('web: getConnectionForUsername fails with UsernameConnectionNotSupportedOnWebError', async () => {
    process.env.ESBUILD_PLATFORM = 'web';
    const exit = await Effect.runPromiseExit(
      ConnectionService.getConnectionForUsername('other@example.com').pipe(Effect.provide(connLayer))
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('UsernameConnectionNotSupportedOnWebError');
  });
});
