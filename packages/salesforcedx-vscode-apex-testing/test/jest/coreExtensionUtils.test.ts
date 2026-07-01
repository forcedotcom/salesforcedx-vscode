/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Mock @salesforce/core before importing
jest.mock('@salesforce/core', () => {
  const mockAuthInfo = { username: 'test@example.com' };
  const mockConnection = {
    getApiVersion: jest.fn().mockReturnValue('61.0'),
    tooling: { query: jest.fn() }
  };
  return {
    AuthInfo: {
      create: jest.fn().mockResolvedValue(mockAuthInfo)
    },
    Connection: {
      create: jest.fn().mockResolvedValue(mockConnection)
    }
  };
});

// Mock extensionProvider
jest.mock('../../src/services/extensionProvider', () => {
  const EffectLib = jest.requireActual('effect/Effect');
  const Context = jest.requireActual('effect/Context');
  const Layer = jest.requireActual('effect/Layer');
  const ManagedRuntime = jest.requireActual('effect/ManagedRuntime');

  const MockExtensionProviderService = Context.GenericTag('ExtensionProviderService');

  let mockConnectionDataRef: any;

  const MockConnectionService = {
    getConnectionData: () => EffectLib.succeed(mockConnectionDataRef)
  };

  const mockServicesApi = {
    services: {
      ConnectionService: MockConnectionService
    }
  };

  const MockAllServicesLayer = Layer.effect(
    MockExtensionProviderService,
    EffectLib.sync(() => ({
      getServicesApi: EffectLib.succeed(mockServicesApi)
    }))
  );

  return {
    ExtensionProviderService: MockExtensionProviderService,
    getApexTestingRuntime: () => ManagedRuntime.make(MockAllServicesLayer),
    __setMockConnectionData: (data: any) => {
      mockConnectionDataRef = data;
    }
  };
});

import { AuthInfo, Connection } from '@salesforce/core';
import * as extensionProvider from '../../src/services/extensionProvider';
import { getConnection } from '../../src/coreExtensionUtils';

describe('getConnection', () => {
  const mockConnectionData = {
    accessToken: 'test-token',
    instanceUrl: 'https://test.salesforce.com',
    apiVersion: '61.0',
    username: 'test@example.com',
    orgId: '00Dxx0000000001EAA'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (extensionProvider as any).__setMockConnectionData(mockConnectionData);
  });

  it('should create desktop connection with username when not in web platform', async () => {
    // Ensure ESBUILD_PLATFORM is not 'web'
    delete process.env.ESBUILD_PLATFORM;

    const connection = await getConnection();

    expect(AuthInfo.create).toHaveBeenCalledWith({ username: mockConnectionData.username });
    expect(Connection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionOptions: { version: mockConnectionData.apiVersion }
      })
    );
    expect(connection).toBeDefined();
  });

  it('should create web connection with access token when ESBUILD_PLATFORM is web', async () => {
    process.env.ESBUILD_PLATFORM = 'web';

    const connection = await getConnection();

    expect(AuthInfo.create).toHaveBeenCalledWith({
      accessTokenOptions: {
        accessToken: mockConnectionData.accessToken,
        loginUrl: mockConnectionData.instanceUrl,
        instanceUrl: mockConnectionData.instanceUrl
      }
    });
    expect(Connection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionOptions: { version: mockConnectionData.apiVersion }
      })
    );
    expect(connection).toBeDefined();

    // Cleanup
    delete process.env.ESBUILD_PLATFORM;
  });

  it('should omit connectionOptions when apiVersion is not provided', async () => {
    const dataWithoutVersion = { ...mockConnectionData, apiVersion: '' };
    (extensionProvider as any).__setMockConnectionData(dataWithoutVersion);
    delete process.env.ESBUILD_PLATFORM;

    await getConnection();

    expect(Connection.create).toHaveBeenCalledWith(
      expect.not.objectContaining({
        connectionOptions: expect.anything()
      })
    );
  });
});
