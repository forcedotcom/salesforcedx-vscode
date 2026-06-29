/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection, Org } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Option from 'effect/Option';
import { getOrgInfoEffect } from '../../../src/util/orgDisplay';

// Mock the Salesforce Core classes
jest.mock('@salesforce/core', () => ({
  AuthInfo: { create: jest.fn() },
  Connection: { create: jest.fn() },
  Org: { create: jest.fn() },
  OrgConfigProperties: { TARGET_ORG: 'target-org' }
}));

type Services = {
  aliases: Record<string, string>;
  configTargetOrg?: string;
};

// Provide ExtensionProviderService with AliasService (alias resolution + alias-by-username) and
// ConfigService (config aggregator) — the only services the org-info Effects read from context.
const provide = <A, E>(effect: Effect.Effect<A, E, ExtensionProviderService>, opts: Services) =>
  Effect.runPromiseExit(
    effect.pipe(
      Effect.provideService(ExtensionProviderService, {
        getServicesApi: Effect.succeed({
          services: {
            AliasService: Effect.succeed({
              getUsernameFromAlias: (alias: string) => Effect.succeed(Option.fromNullable(opts.aliases[alias])),
              getAllAliases: () => Effect.succeed(opts.aliases)
            }),
            ConfigService: Effect.succeed({
              getConfigAggregator: () =>
                Effect.succeed({
                  getPropertyValue: (_key: string) => opts.configTargetOrg
                })
            })
          }
        })
      } as unknown as ExtensionProviderService)
    ) as Effect.Effect<A, E, never>
  );

describe('orgDisplay Effect util', () => {
  let mockAuthInfo: any;
  let mockConnection: any;
  let mockOrg: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthInfo = {
      getUsername: jest.fn().mockReturnValue('test@example.com'),
      getFields: jest.fn().mockReturnValue({
        username: 'test@example.com',
        orgId: '00D1234567890123',
        accessToken: 'test-token',
        instanceUrl: 'https://test.salesforce.com',
        clientId: 'test-client-id'
      })
    };

    mockConnection = {
      identity: jest.fn().mockResolvedValue({}),
      singleRecordQuery: jest.fn().mockResolvedValue({
        Id: '00D1234567890123',
        Name: 'Test Org',
        CreatedDate: '2024-01-01T00:00:00.000+0000',
        CreatedBy: { Username: 'admin@example.com' },
        OrganizationType: 'Enterprise'
      }),
      instanceUrl: 'https://test.salesforce.com',
      accessToken: 'test-token'
    };

    mockOrg = { getDevHubOrg: jest.fn() };

    jest.mocked(AuthInfo).create.mockResolvedValue(mockAuthInfo);
    jest.mocked(Connection).create.mockResolvedValue(mockConnection);
    jest.mocked(Org).create.mockResolvedValue(mockOrg);
  });

  it('gets org info with a username provided', async () => {
    const exit = await provide(getOrgInfoEffect('test@example.com'), { aliases: {} });
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

  it('resolveUsername: falls back to the config target-org when none provided', async () => {
    const exit = await provide(getOrgInfoEffect(), { aliases: {}, configTargetOrg: 'test@example.com' });
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) expect(exit.value.username).toBe('test@example.com');
  });

  it('resolveUsername: resolves a config alias to its username', async () => {
    const exit = await provide(getOrgInfoEffect(), {
      aliases: { 'test-alias': 'test@example.com' },
      configTargetOrg: 'test-alias'
    });
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) expect(exit.value.username).toBe('test@example.com');
  });

  it('resolveUsername: fails with NoUsernameError when nothing resolves', async () => {
    const exit = await provide(getOrgInfoEffect(), { aliases: {} });
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('NoUsernameError');
  });

  it('supplements aliases from disk for the resolved username', async () => {
    const exit = await provide(getOrgInfoEffect('test@example.com'), {
      aliases: { alias1: 'test@example.com', alias2: 'test@example.com' }
    });
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) expect(exit.value.aliases).toEqual(['alias1', 'alias2']);
  });

  it('connection-failure path: returns a degraded OrgInfo (typed catch, not a die)', async () => {
    // AuthInfo.create throwing maps to OrgInfoConnectionError -> graceful degradation via buildErrorOrgInfo.
    const authError = new Error('Error authenticating with the refresh token due to: expired access/refresh token');
    jest.mocked(AuthInfo).create.mockRejectedValueOnce(authError).mockRejectedValueOnce(authError);

    const exit = await provide(getOrgInfoEffect('test@example.com'), { aliases: {} });
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.username).toBe('test@example.com');
      expect(exit.value.connectionStatus).toBe('Unable to refresh session: expired access/refresh token');
      expect(exit.value.id).toBe('');
      expect(exit.value.accessToken).toBe('');
    }
  });

  it('SOQL-failure path: returns a degraded OrgInfo with error status', async () => {
    const queryError = new Error('Error authenticating with the refresh token due to: expired access/refresh token');
    mockConnection.singleRecordQuery.mockRejectedValue(queryError);

    const exit = await provide(getOrgInfoEffect('test@example.com'), { aliases: {} });
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.username).toBe('test@example.com');
      expect(exit.value.connectionStatus).toBe('Unable to refresh session: expired access/refresh token');
      // AuthInfo creation succeeded, so the degraded fallback still carries auth fields
      expect(exit.value.accessToken).toBe('test-token');
      expect(exit.value.instanceUrl).toBe('https://test.salesforce.com');
    }
  });

  it('detects a scratch org via the dev hub query', async () => {
    mockAuthInfo.getFields.mockReturnValue({
      username: 'test@example.com',
      orgId: '00D1234567890123',
      accessToken: 'test-token',
      instanceUrl: 'https://test.salesforce.com',
      clientId: 'test-client-id',
      devHubUsername: 'devhub@example.com'
    });
    mockOrg.getDevHubOrg.mockResolvedValue({
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
    });

    const exit = await provide(getOrgInfoEffect('test@example.com'), { aliases: {} });
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.devHubId).toBe('devhub@example.com');
      expect(exit.value.edition).toBe('Developer');
      expect(exit.value.status).toBe('Active');
      expect(exit.value.expirationDate).toBe('2024-12-31T00:00:00.000+0000');
    }
  });
});
