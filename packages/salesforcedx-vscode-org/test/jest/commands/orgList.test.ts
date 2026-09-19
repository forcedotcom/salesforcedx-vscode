/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Mock as VitestMock, MockInstance as VitestMockInstance } from 'vitest';
import { AuthInfo, AuthRemover, OrgAuthorization } from '@salesforce/core';
import { createTable, ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { SalesforceVSCodeServicesApi } from '@salesforce/vscode-services';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { nls } from '../../../src/messages';
import {
  determineConnectedStatusForNonScratchOrg,
  findRemovableOrgs,
  removeExpiredAndDeletedOrgs,
  displayRemainingOrgs,
  shouldRemoveOrg,
  getConnectionStatusFromError
} from '../../../src/util/orgUtil';

// The migrated helpers are pure Effects: they resolve org auths through ConnectionService.listAllAuthorizations
// (an Effect) and write to the Effect ChannelService (yielded off the services api), never the legacy singleton.
let listAllAuthorizationsMock: VitestMock;
let getConnectionMock: VitestMock;
let appendToChannelMock: VitestMock;
let showChannelMock: VitestMock;

// Mock the dependencies
vi.mock('@salesforce/core', () => ({
  AuthRemover: {
    create: vi.fn()
  },
  AuthInfo: {
    create: vi.fn(),
    listAllAuthorizations: vi.fn()
  },
  ConfigAggregator: {
    create: vi.fn().mockImplementation(() => ({
      getPropertyValue: vi.fn()
    }))
  },
  OrgConfigProperties: {
    TARGET_DEV_HUB: 'target-dev-hub',
    TARGET_ORG: 'target-org'
  }
}));
vi.mock('@salesforce/effect-ext-utils', async () => {
  const actual = await vi.importActual<typeof import('@salesforce/effect-ext-utils')>('@salesforce/effect-ext-utils');
  return {
    createTable: vi.fn(),
    ExtensionProviderService: actual.ExtensionProviderService
  };
});

// Seed ExtensionProviderService with the mocked ConnectionService.listAllAuthorizations (an Effect),
// a ConfigService whose default-org lookups resolve to undefined, and a ChannelService whose
// appendToChannel/showChannel are jest mocks so we can assert channel output.
const buildServicesLayer = (listMock: VitestMock) =>
  Layer.succeed(ExtensionProviderService, {
    getServicesApi: Effect.succeed({
      services: {
        ConnectionService: {
          listAllAuthorizations: listMock,
          getConnection: getConnectionMock
        },
        ConfigService: {
          getTargetDevHub: () => Effect.succeed(undefined),
          getTargetOrg: () => Effect.succeed(undefined)
        },
        ChannelService: Effect.succeed({
          appendToChannel: (message: string) => Effect.sync(() => appendToChannelMock(message)),
          showChannel: Effect.sync(() => showChannelMock())
        }),
        NotificationModeService: Effect.succeed({
          getProgressLocation: () => Effect.succeed(1),
          showSuccessNotification: () => Effect.void
        })
      }
    } as unknown as SalesforceVSCodeServicesApi)
  } as unknown as ExtensionProviderService);

// Run a helper Effect against the seeded layer. The migrated helpers leak ChannelService /
// ConnectionService (and, via getDefaultOrgConfiguration, Alias/Config services) into their R
// channel because they yield those off the services api; at runtime the seeded mock api satisfies
// them, so widen R to ExtensionProviderService for the type-only provide.
const runWithServices = <A, E, R>(effect: Effect.Effect<A, E, R>): Promise<A> =>
  Effect.runPromise(
    (effect as Effect.Effect<A, E, ExtensionProviderService>).pipe(
      Effect.provide(buildServicesLayer(listAllAuthorizationsMock))
    )
  );

describe('orgList command', () => {
  let mockAuthInfoCreate: VitestMockInstance;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Default the ConnectionService.listAllAuthorizations mock to an empty Effect; suites override below.
    listAllAuthorizationsMock = vi.fn().mockReturnValue(Effect.succeed([] as OrgAuthorization[]));
    // Default getConnection to a never-called stub; the determineConnectedStatus suite overrides it.
    getConnectionMock = vi.fn();
    appendToChannelMock = vi.fn();
    showChannelMock = vi.fn();

    // Mock createTable function
    (createTable as VitestMock).mockReturnValue('mocked table output');

    mockAuthInfoCreate = vi.mocked(AuthInfo.create);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('determineConnectedStatusForNonScratchOrg', () => {
    // conn stands in for the jsforce Connection getConnection(username) resolves to.
    const mockConn = {
      getAuthInfoFields: vi.fn(),
      refreshAuth: vi.fn(),
      getUsername: vi.fn().mockReturnValue('test@example.com')
    };

    beforeEach(() => {
      mockConn.getAuthInfoFields.mockReset();
      mockConn.refreshAuth.mockReset();
      // Default: getConnection succeeds with mockConn; per-test overrides for failure cases.
      getConnectionMock.mockReturnValue(Effect.succeed(mockConn));
    });

    it('should return undefined for scratch orgs', async () => {
      mockConn.getAuthInfoFields.mockReturnValue({ devHubUsername: 'hub@example.com' });

      const result = await runWithServices(determineConnectedStatusForNonScratchOrg('scratch@example.com'));

      expect(result).toBeUndefined();
      expect(mockConn.refreshAuth).not.toHaveBeenCalled();
    });

    it('should return Connected for valid non-scratch org', async () => {
      mockConn.getAuthInfoFields.mockReturnValue({}); // No devHubUsername
      mockConn.refreshAuth.mockResolvedValue(undefined);

      const result = await runWithServices(determineConnectedStatusForNonScratchOrg('prod@example.com'));

      expect(result).toBe('Connected');
      expect(mockConn.refreshAuth).toHaveBeenCalled();
    });

    it('should handle refreshAuth live-probe errors', async () => {
      mockConn.getAuthInfoFields.mockReturnValue({});
      mockConn.refreshAuth.mockRejectedValue(new Error('Connection failed'));

      const result = await runWithServices(determineConnectedStatusForNonScratchOrg('invalid@example.com'));

      // getConnectionStatusFromError falls through to the raw message for unrecognized errors
      expect(result).toBe('Connection failed');
    });

    // The real getConnection tags are Schema.TaggedError (extend Error), so getConnectionStatusFromError
    // reads `.message`. Model that with an Error instance carrying the `_tag` catchTags matches on.
    const taggedError = (tag: string, message: string) => Object.assign(new Error(message), { _tag: tag });

    it('should classify a removable getConnection failure via the distinct tag (not a generic collapse)', async () => {
      getConnectionMock.mockReturnValue(
        Effect.fail(taggedError('FailedToCreateAuthInfoError', 'no such org: NamedOrgNotFound'))
      );

      const result = await runWithServices(determineConnectedStatusForNonScratchOrg('notfound@example.com'));

      // proves the distinct tag reaches the string-matcher (shouldRemoveOrg → Invalid org)
      expect(result).toBe('Invalid org: notfound@example.com');
      expect(mockConn.refreshAuth).not.toHaveBeenCalled();
    });

    it('should fall through to the raw message for a non-removable getConnection failure', async () => {
      getConnectionMock.mockReturnValue(
        Effect.fail(taggedError('FailedToCreateConnectionError', 'Failed to create connection: boom'))
      );

      const result = await runWithServices(determineConnectedStatusForNonScratchOrg('prod@example.com'));

      expect(result).toBe('Failed to create connection: boom');
    });
  });

  describe('shouldRemoveOrg', () => {
    it('should return true for invalid_login errors', () => {
      const error = new Error('invalid_login: authentication failure');
      expect(shouldRemoveOrg(error)).toBe(true);
    });

    it('should return true for no such org errors', () => {
      const error = new Error('no such org exists');
      expect(shouldRemoveOrg(error)).toBe(true);
    });

    it('should return true for NamedOrgNotFound errors', () => {
      const error = new Error('NamedOrgNotFound: org does not exist');
      expect(shouldRemoveOrg(error)).toBe(true);
    });

    it('should return true for NoAuthInfoFound errors', () => {
      const error = new Error('noauthinfoFound: no auth info');
      expect(shouldRemoveOrg(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = new Error('Some other error');
      expect(shouldRemoveOrg(error)).toBe(false);
    });
  });

  describe('getConnectionStatusFromError', () => {
    it('should return specific message for expired access token', () => {
      const error = new Error('expired access/refresh token');
      const result = getConnectionStatusFromError(error, 'test@example.com');
      expect(result).toBe('Unable to refresh session: expired access/refresh token');
    });

    it('should return maintenance message', () => {
      const error = new Error('System is under maintenance');
      const result = getConnectionStatusFromError(error, 'test@example.com');
      expect(result).toBe('Down (Maintenance)');
    });

    it('should return invalid org message for removable errors', () => {
      const error = new Error('invalid_login: authentication failure');
      const result = getConnectionStatusFromError(error, 'test@example.com');
      expect(result).toBe('Invalid org: test@example.com');
    });

    it('should return original message for unknown errors', () => {
      const error = new Error('Unknown error');
      const result = getConnectionStatusFromError(error, 'test@example.com');
      expect(result).toBe('Unknown error');
    });

    it('should handle string errors', () => {
      const result = getConnectionStatusFromError('String error');
      expect(result).toBe('String error');
    });
  });

  describe('findRemovableOrgs', () => {
    const mockOrgAuths = [
      {
        username: 'valid@example.com',
        isDevHub: false,
        error: undefined
      },
      {
        username: 'devhub@example.com',
        isDevHub: true,
        error: undefined
      },
      {
        username: 'expired@example.com',
        isDevHub: false,
        error: undefined
      }
    ];

    beforeEach(() => {
      listAllAuthorizationsMock.mockReturnValue(Effect.succeed(mockOrgAuths as unknown as OrgAuthorization[]));
    });

    it('should skip dev hubs', async () => {
      mockAuthInfoCreate.mockResolvedValue({ getFields: () => ({}) });

      await runWithServices(findRemovableOrgs());

      expect(mockAuthInfoCreate).not.toHaveBeenCalledWith({ username: 'devhub@example.com' });
    });

    it('should classify expired orgs as removable without removing them', async () => {
      const pastDate = new Date('2020-01-01').toISOString();
      mockAuthInfoCreate.mockImplementation(({ username }: { username: string }) =>
        Promise.resolve({ getFields: () => (username === 'expired@example.com' ? { expirationDate: pastDate } : {}) })
      );

      const result = await runWithServices(findRemovableOrgs());

      expect(result.map(o => o.username)).toEqual(['expired@example.com']);
      // classification must not mutate auth state
      expect(AuthRemover.create).not.toHaveBeenCalled();
    });

    it('should not classify orgs when getAuthFieldsFor fails with a non-removable error', async () => {
      mockAuthInfoCreate.mockRejectedValue('Auth fields error');

      const result = await runWithServices(findRemovableOrgs());

      expect(result).toEqual([]);
      expect(appendToChannelMock).toHaveBeenCalledWith(
        expect.stringContaining(
          nls.localize('org_list_clean_error_checking_org', 'valid@example.com', 'Auth fields error')
        )
      );
    });
  });

  describe('removeExpiredAndDeletedOrgs', () => {
    const mockAuthRemover = {
      removeAuth: vi.fn()
    };

    beforeEach(() => {
      (AuthRemover.create as VitestMock).mockResolvedValue(mockAuthRemover);
      mockAuthRemover.removeAuth.mockResolvedValue(undefined);
    });

    it('should remove each given org and return removed usernames', async () => {
      const result = await runWithServices(
        removeExpiredAndDeletedOrgs([{ username: 'expired@example.com', logLine: 'removing expired' }])
      );

      expect(mockAuthRemover.removeAuth).toHaveBeenCalledWith('expired@example.com');
      expect(result).toEqual(['expired@example.com']);
    });

    it('should keep removing after a removal failure and exclude the failed org', async () => {
      mockAuthRemover.removeAuth.mockRejectedValueOnce(new Error('remove failed')).mockResolvedValueOnce(undefined);

      const result = await runWithServices(
        removeExpiredAndDeletedOrgs([
          { username: 'bad@example.com', logLine: 'removing bad' },
          { username: 'expired@example.com', logLine: 'removing expired' }
        ])
      );

      expect(result).toEqual(['expired@example.com']);
      expect(appendToChannelMock).toHaveBeenCalledWith(
        expect.stringContaining(nls.localize('org_list_clean_failed_to_remove_org', 'bad@example.com', 'remove failed'))
      );
    });
  });

  describe('displayRemainingOrgs', () => {
    const mockOrgAuths = [
      {
        username: 'test@example.com',
        aliases: ['testOrg'],
        isDevHub: false,
        isScratch: false,
        orgId: '00D000000000000EAA'
      }
    ];

    beforeEach(() => {
      listAllAuthorizationsMock.mockReturnValue(Effect.succeed(mockOrgAuths as unknown as OrgAuthorization[]));
      // scratch (has expirationDate) => 'Active' branch, so determineConnectedStatusForNonScratchOrg is skipped
      mockAuthInfoCreate.mockResolvedValue({
        getFields: () => ({ expirationDate: new Date('2999-01-01').toISOString() })
      });
    });

    it('should display message when no orgs found', async () => {
      listAllAuthorizationsMock.mockReturnValue(Effect.succeed([] as OrgAuthorization[]));

      await runWithServices(displayRemainingOrgs());

      expect(appendToChannelMock).toHaveBeenCalledWith(expect.stringContaining(nls.localize('org_list_no_orgs_found')));
    });

    it('should create and display table for orgs', async () => {
      await runWithServices(displayRemainingOrgs());

      expect(createTable).toHaveBeenCalled();
      expect(appendToChannelMock).toHaveBeenCalledWith(expect.stringContaining('mocked table output'));
    });

    it('should add legend for emoji markers', async () => {
      await runWithServices(displayRemainingOrgs());

      expect(appendToChannelMock).toHaveBeenCalledWith(
        expect.stringContaining('Legend:  🌳=Default DevHub, 🍁=Default Org')
      );
    });

    it('should handle errors gracefully', async () => {
      // displayRemainingOrgs catches FailedToListAuthorizationsError (the tag ConnectionService raises)
      // and writes org_list_display_error to the channel. catchTag matches on _tag.
      listAllAuthorizationsMock.mockReturnValue(
        Effect.fail({ _tag: 'FailedToListAuthorizationsError', message: 'List error' })
      );

      await runWithServices(displayRemainingOrgs());

      expect(appendToChannelMock).toHaveBeenCalledWith(
        expect.stringContaining(nls.localize('org_list_display_error', 'List error'))
      );
    });

    // A dev hub has no expirationDate, so @salesforce/core reports isExpired: 'unknown' (a truthy
    // string). processOrgForDisplay must only skip DEFINITELY-expired orgs (=== true), otherwise the
    // dev hub is dropped and its live connection status is never probed (regression: hub row missing).
    it('should not skip a non-scratch org whose isExpired is "unknown"', async () => {
      listAllAuthorizationsMock.mockReturnValue(
        Effect.succeed([
          { username: 'hub@example.com', aliases: ['hub'], isDevHub: false, isScratch: false, isExpired: 'unknown' }
        ] as unknown as OrgAuthorization[])
      );
      // Non-scratch (no expirationDate) => determineConnectedStatusForNonScratchOrg runs the live probe.
      mockAuthInfoCreate.mockResolvedValue({ getFields: () => ({}) });
      const mockConn = {
        getAuthInfoFields: vi.fn().mockReturnValue({}),
        refreshAuth: vi.fn().mockResolvedValue(undefined),
        getUsername: vi.fn().mockReturnValue('hub@example.com')
      };
      getConnectionMock.mockReturnValue(Effect.succeed(mockConn));

      await runWithServices(displayRemainingOrgs());

      // The org was processed (not early-returned): its auth fields were fetched and the live probe ran.
      expect(mockAuthInfoCreate).toHaveBeenCalledWith({ username: 'hub@example.com' });
      expect(mockConn.refreshAuth).toHaveBeenCalled();
    });
  });
});
