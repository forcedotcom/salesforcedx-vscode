/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, StateAggregator } from '@salesforce/core';
import {
  buildAllServicesLayer,
  ExtensionProviderService,
  type ExtensionProviderService as ExtensionProviderServiceType
} from '@salesforce/effect-ext-utils';
import { ConfigUtil, notificationService, ConfigAggregatorProvider } from '@salesforce/salesforcedx-utils-vscode';
import type { SalesforceVSCodeServicesApi } from '@salesforce/vscode-services';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { channelService } from '../../../src/channels';
import { resetOrgRuntimeForTesting, setAllServicesLayer } from '../../../src/extensionProvider';
import { nls } from '../../../src/messages';
import { checkForSoonToBeExpiredOrgs, updateConfigAndStateAggregators } from '../../../src/util/orgUtil';

describe('orgUtil tests', () => {
  let showWarningMessageSpy: jest.SpyInstance;
  let appendLineSpy: jest.SpyInstance;
  let showChannelOutputSpy: jest.SpyInstance;
  let listAllAuthorizationsSpy: jest.SpyInstance;
  let authInfoCreateSpy: jest.SpyInstance;
  let getUsernameMock: jest.SpyInstance;
  let mockWatcher: any;

  const orgName1 = 'dreamhouse-org';
  const orgName2 = 'ebikes-lwc';
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 24 * 3 * 60 * 60_000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60_000);

  // Create mock TargetOrgRef function
  const createMockTargetOrgRef = (username?: string) => () =>
    Effect.gen(function* () {
      const ref = yield* SubscriptionRef.make<{ username?: string }>({ username });
      return ref;
    });

  beforeEach(() => {
    mockWatcher = {
      onDidChange: jest.fn(),
      onDidCreate: jest.fn(),
      onDidDelete: jest.fn()
    };
    (vscode.workspace.createFileSystemWatcher as any).mockReturnValue(mockWatcher);
    (vscode.window.createStatusBarItem as any).mockReturnValue({
      command: '',
      text: '',
      tooltip: '',
      show: jest.fn(),
      dispose: jest.fn()
    });
    // Ensure core API is available for OrgList constructor usage
    jest.spyOn(vscode.extensions as any, 'getExtension').mockReturnValue({
      exports: {
        WorkspaceContext: {
          getInstance: () => ({
            username: undefined,
            alias: undefined,
            onOrgChange: jest.fn()
          })
        }
      }
    } as any);
    showWarningMessageSpy = jest.spyOn(notificationService, 'showWarningMessage').mockImplementation(jest.fn());
    appendLineSpy = jest.spyOn(channelService, 'appendLine').mockImplementation(jest.fn());
    showChannelOutputSpy = jest.spyOn(channelService, 'showChannelOutput');
    listAllAuthorizationsSpy = jest.spyOn(AuthInfo, 'listAllAuthorizations');
    authInfoCreateSpy = jest.spyOn(AuthInfo, 'create');
    getUsernameMock = jest.spyOn(ConfigUtil, 'getUsername');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should not display a notification when no orgs are present', async () => {
    listAllAuthorizationsSpy.mockResolvedValue([]);
    const mockServicesApi = {
      services: {
        TargetOrgRef: createMockTargetOrgRef()
      }
    } as unknown as SalesforceVSCodeServicesApi;
    const mockLayer = Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed(mockServicesApi) as ExtensionProviderServiceType['getServicesApi']
    });
    await checkForSoonToBeExpiredOrgs().pipe(Effect.provide(mockLayer), Effect.runPromise);

    expect(showWarningMessageSpy).not.toHaveBeenCalled();
    expect(appendLineSpy).not.toHaveBeenCalled();
    expect(showChannelOutputSpy).not.toHaveBeenCalled();
  });

  it('should not display a notification when dev hubs are present', async () => {
    listAllAuthorizationsSpy.mockResolvedValue([
      {
        isDevHub: true,
        username: 'foo',
        aliases: [orgName1]
      },
      {
        isDevHub: true,
        username: 'bar',
        aliases: [orgName2]
      }
    ]);
    const mockServicesApi = {
      services: {
        TargetOrgRef: createMockTargetOrgRef()
      }
    } as unknown as SalesforceVSCodeServicesApi;
    const mockLayer = Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed(mockServicesApi) as ExtensionProviderServiceType['getServicesApi']
    });
    await checkForSoonToBeExpiredOrgs().pipe(Effect.provide(mockLayer), Effect.runPromise);

    expect(showWarningMessageSpy).not.toHaveBeenCalled();
    expect(appendLineSpy).not.toHaveBeenCalled();
    expect(showChannelOutputSpy).not.toHaveBeenCalled();
    expect(authInfoCreateSpy).not.toHaveBeenCalled();
  });

  it('should display a notification when the scratch org has already expired', async () => {
    listAllAuthorizationsSpy.mockResolvedValue([
      {
        isDevHub: false,
        isScratchOrg: true,
        username: 'foo',
        aliases: [orgName1]
      }
    ]);

    authInfoCreateSpy.mockResolvedValue({
      getFields: () => ({
        username: 'foo',
        alias: orgName1,
        expirationDate: `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`
      })
    });
    getUsernameMock.mockResolvedValue('foo');
    const mockServicesApi = {
      services: {
        TargetOrgRef: createMockTargetOrgRef('foo')
      }
    } as unknown as SalesforceVSCodeServicesApi;
    const mockLayer = Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed(mockServicesApi) as ExtensionProviderServiceType['getServicesApi']
    });
    await checkForSoonToBeExpiredOrgs().pipe(Effect.provide(mockLayer), Effect.runPromise);

    expect(showWarningMessageSpy).toHaveBeenCalled();
    expect(appendLineSpy).not.toHaveBeenCalled();
    expect(showChannelOutputSpy).not.toHaveBeenCalled();
    expect(authInfoCreateSpy).toHaveBeenCalled();
  });

  it('should display a notification when the scratch org is about to expire', async () => {
    listAllAuthorizationsSpy.mockResolvedValue([
      {
        isDevHub: false,
        isScratchOrg: true,
        username: 'foo',
        aliases: [orgName1]
      }
    ]);

    authInfoCreateSpy.mockResolvedValue({
      getFields: () => ({
        username: 'foo',
        alias: orgName1,
        expirationDate: `${threeDaysFromNow.getFullYear()}-${
          threeDaysFromNow.getMonth() + 1
        }-${threeDaysFromNow.getDate()}`
      })
    });
    const mockServicesApi = {
      services: {
        TargetOrgRef: createMockTargetOrgRef()
      }
    } as unknown as SalesforceVSCodeServicesApi;
    const mockLayer = Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed(mockServicesApi) as ExtensionProviderServiceType['getServicesApi']
    });
    await checkForSoonToBeExpiredOrgs().pipe(Effect.provide(mockLayer), Effect.runPromise);

    expect(showWarningMessageSpy).toHaveBeenCalled();
    expect(appendLineSpy).toHaveBeenCalled();
    expect(appendLineSpy.mock.calls[0][0]).toContain(orgName1);
    expect(appendLineSpy.mock.calls[0][0]).toContain('foo');
    expect(showChannelOutputSpy).toHaveBeenCalled();
  });

  it('should display multiple orgs in the output when there are several scratch orgs about to expire', async () => {
    listAllAuthorizationsSpy.mockResolvedValue([
      {
        isDevHub: false,
        isScratchOrg: true,
        username: 'foo',
        aliases: [orgName1]
      },
      {
        isDevHub: false,
        isScratchOrg: true,
        username: 'bar',
        aliases: [orgName2]
      }
    ]);

    authInfoCreateSpy
      .mockResolvedValueOnce({
        getFields: () => ({
          username: 'foo',
          alias: orgName1,
          expirationDate: `${threeDaysFromNow.getFullYear()}-${
            threeDaysFromNow.getMonth() + 1
          }-${threeDaysFromNow.getDate()}`
        })
      })
      .mockResolvedValueOnce({
        getFields: () => ({
          username: 'bar',
          alias: orgName2,
          expirationDate: `${threeDaysFromNow.getFullYear()}-${
            threeDaysFromNow.getMonth() + 1
          }-${threeDaysFromNow.getDate()}`
        })
      });
    const mockServicesApi = {
      services: {
        TargetOrgRef: createMockTargetOrgRef()
      }
    } as unknown as SalesforceVSCodeServicesApi;
    const mockLayer = Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed(mockServicesApi) as ExtensionProviderServiceType['getServicesApi']
    });
    await checkForSoonToBeExpiredOrgs().pipe(Effect.provide(mockLayer), Effect.runPromise);

    expect(showWarningMessageSpy).toHaveBeenCalled();
    expect(appendLineSpy).toHaveBeenCalled();
    expect(appendLineSpy.mock.calls[0][0]).toContain(orgName1);
    expect(appendLineSpy.mock.calls[0][0]).toContain('foo');
    expect(appendLineSpy.mock.calls[0][0]).toContain(orgName2);
    expect(appendLineSpy.mock.calls[0][0]).toContain('bar');
    expect(showChannelOutputSpy).toHaveBeenCalled();
  });

  it('should display notifications for both an expired org and an org about to expire', async () => {
    const orgNameExpired = 'expired-org';
    const orgNameAboutToExpire = 'about-to-expire-org';

    // Define the expiration dates
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 1); // Expired
    const aboutToExpireDate = new Date();
    aboutToExpireDate.setDate(aboutToExpireDate.getDate() + 2); // About to expire

    // Mock listAllAuthorizations to return both expired and about-to-expire orgs
    listAllAuthorizationsSpy.mockResolvedValue([
      {
        isDevHub: false,
        isScratchOrg: true,
        username: 'about-to-expire-org@salesforce.com',
        aliases: [orgNameAboutToExpire]
      },
      {
        isDevHub: false,
        isScratchOrg: true,
        username: 'expired-org@salesforce.com',
        aliases: [orgNameExpired]
      }
    ]);

    // Mock authInfoCreate to return different expiration dates based on org name
    authInfoCreateSpy.mockResolvedValueOnce({
      getFields: () => ({
        username: 'about-to-expire-org@salesforce.com',
        alias: orgNameAboutToExpire,
        expirationDate: `${aboutToExpireDate.getFullYear()}-${
          aboutToExpireDate.getMonth() + 1
        }-${aboutToExpireDate.getDate()}`
      })
    });
    authInfoCreateSpy.mockResolvedValueOnce({
      getFields: () => ({
        username: 'expired-org@salesforce.com',
        alias: orgNameExpired,
        expirationDate: `${expiredDate.getFullYear()}-${expiredDate.getMonth() + 1}-${expiredDate.getDate()}`
      })
    });
    getUsernameMock.mockResolvedValue('expired-org@salesforce.com');
    const mockServicesApi = {
      services: {
        TargetOrgRef: createMockTargetOrgRef('expired-org@salesforce.com')
      }
    } as unknown as SalesforceVSCodeServicesApi;
    const mockLayer = Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed(mockServicesApi) as ExtensionProviderServiceType['getServicesApi']
    });
    await checkForSoonToBeExpiredOrgs().pipe(Effect.provide(mockLayer), Effect.runPromise);

    // Assert that the notifications for both orgs are displayed
    expect(showWarningMessageSpy).toHaveBeenCalledTimes(2);
    expect(appendLineSpy).toHaveBeenCalled();
    expect(showChannelOutputSpy).toHaveBeenCalled();

    // Verify the specific calls
    const calls = showWarningMessageSpy.mock.calls.map(call => call[0]);
    expect(calls[0]).toContain(nls.localize('default_org_expired'));
    expect(calls[1]).toContain(
      'Warning: One or more of your orgs expire in the next 5 days. For more details, review the Output panel.'
    );
  });
});

describe('updateConfigAndStateAggregators', () => {
  let getConnectionMock: jest.Mock;
  let invalidateCachedConnectionsMock: jest.Mock;
  let invalidateConfigAggregatorMock: jest.Mock;

  beforeEach(() => {
    jest.restoreAllMocks();
    resetOrgRuntimeForTesting();

    jest.spyOn(ConfigAggregatorProvider, 'getInstance').mockReturnValue({
      reloadConfigAggregators: jest.fn()
    } as any);
    jest.spyOn(StateAggregator, 'clearInstanceAsync').mockResolvedValue();
    (vscode.commands.executeCommand as jest.Mock).mockResolvedValue(undefined);

    getConnectionMock = jest.fn().mockReturnValue(Effect.succeed({}));
    invalidateCachedConnectionsMock = jest.fn().mockReturnValue(Effect.void);
    invalidateConfigAggregatorMock = jest.fn().mockReturnValue(Effect.void);

    const mockServicesApi = {
      services: {
        ConfigService: {
          invalidateConfigAggregator: invalidateConfigAggregatorMock
        },
        ConnectionService: {
          getConnection: getConnectionMock,
          invalidateCachedConnections: invalidateCachedConnectionsMock
        }
      }
    } as unknown as SalesforceVSCodeServicesApi;

    const layer = Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed(mockServicesApi) as ExtensionProviderServiceType['getServicesApi']
    });

    resetOrgRuntimeForTesting();
    setAllServicesLayer(layer as ReturnType<typeof buildAllServicesLayer>);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetOrgRuntimeForTesting();
  });

  it('should call getConnection after invalidating caches to refresh TargetOrgRef', async () => {
    await updateConfigAndStateAggregators();

    expect(invalidateConfigAggregatorMock).toHaveBeenCalled();
    expect(invalidateCachedConnectionsMock).toHaveBeenCalled();
    expect(getConnectionMock).toHaveBeenCalled();
  });

  it('should not throw when getConnection fails', async () => {
    getConnectionMock.mockReturnValue(Effect.fail(new Error('No target org configured')));

    await expect(updateConfigAndStateAggregators()).resolves.toBeUndefined();
    expect(invalidateConfigAggregatorMock).toHaveBeenCalled();
    expect(invalidateCachedConnectionsMock).toHaveBeenCalled();
    expect(getConnectionMock).toHaveBeenCalled();
  });
});
