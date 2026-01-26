/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Mocks are hoisted; static import is fine

jest.mock('../../../src/services/extensionProvider', () => {
  const EffectLib = jest.requireActual('effect/Effect');
  const Context = jest.requireActual('effect/Context');
  const Layer = jest.requireActual('effect/Layer');

  const MockExtensionProviderService = Context.GenericTag('ExtensionProviderService');
  const MockConnectionServiceTag = Context.GenericTag('ConnectionService');

  // This will be set by tests via __setMockConnection
  let mockConnectionRef: any;

  const mockConnectionService = {
    get getConnection() {
      return EffectLib.succeed(mockConnectionRef);
    }
  };

  const mockServicesApi = {
    services: {
      ConnectionService: MockConnectionServiceTag
    }
  };

  const MockAllServicesLayer = Layer.mergeAll(
    Layer.effect(
      MockExtensionProviderService,
      EffectLib.sync(() => ({
        getServicesApi: EffectLib.succeed(mockServicesApi)
      }))
    ),
    Layer.effect(
      MockConnectionServiceTag,
      EffectLib.sync(() => mockConnectionService)
    )
  );

  return {
    ExtensionProviderService: MockExtensionProviderService,
    AllServicesLayer: MockAllServicesLayer,
    // Export a function to set the mock connection
    __setMockConnection: (conn: any) => {
      mockConnectionRef = conn;
    }
  };
});

import * as Effect from 'effect/Effect';
import * as extensionProvider from '../../../src/services/extensionProvider';
import { discoverTests } from '../../../src/testDiscovery/testDiscovery';

const mockConnection = {
  instanceUrl: 'https://example.com',
  getApiVersion: () => '61.0',
  request: jest.fn()
} as any;

describe('TestDiscovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set the mock connection for the extensionProvider mock
    (extensionProvider as any).__setMockConnection(mockConnection);
  });

  it('returns classes and methods from /tooling/tests endpoint', async () => {
    const page1 = {
      apexTestClasses: [
        {
          id: '01pABC',
          name: 'MyTestClass',
          namespacePrefix: 'ns',
          testMethods: [{ name: 'testOne' }, { name: 'testTwo' }]
        }
      ],
      nextRecordsUrl: '/services/data/v65.0/tooling/tests?nextRecord=ns.OtherClass'
    };
    const page2 = {
      apexTestClasses: [
        {
          id: '01pDEF',
          name: 'OtherClass',
          namespacePrefix: 'ns',
          testMethods: [{ name: 'x' }]
        }
      ],
      nextRecordsUrl: null
    };
    (mockConnection.request as jest.Mock).mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);

    const result = await Effect.runPromise(discoverTests());

    expect(result.classes).toHaveLength(2);
    expect(result.classes[0].name).toBe('MyTestClass');
    expect(result.classes[0].testMethods).toHaveLength(2);
    expect(result.classes[1].name).toBe('OtherClass');
    expect(result.classes[1].testMethods).toHaveLength(1);
  });

  it('gracefully returns empty when API returns no classes', async () => {
    (mockConnection.request as jest.Mock).mockResolvedValueOnce({ apexTestClasses: [], nextRecordsUrl: null });
    const result = await Effect.runPromise(discoverTests());
    expect(result.classes).toHaveLength(0);
  });

  it('handles API errors', async () => {
    (mockConnection.request as jest.Mock).mockRejectedValueOnce(new Error('Boom'));
    await expect(Effect.runPromise(discoverTests())).rejects.toThrow('Failed to fetch test discovery page: Boom');
  });

  it('uses minimum API version 65.0 and always sets showAllMethods=true', async () => {
    (mockConnection.request as jest.Mock).mockResolvedValueOnce({ apexTestClasses: [], nextRecordsUrl: null });
    await Effect.runPromise(discoverTests());
    expect(mockConnection.request).toHaveBeenCalledTimes(1);
    const firstCallArg = (mockConnection.request as jest.Mock).mock.calls[0][0];
    expect(firstCallArg.method).toBe('GET');
    expect(firstCallArg.url).toMatch(/^\/services\/data\/v65\.0\/tooling\/tests\?/);
    expect(firstCallArg.url).toContain('showAllMethods=true');
    expect(firstCallArg.url).not.toContain('namespacePrefix=');
  });

  it('passes namespacePrefix when provided', async () => {
    (mockConnection.request as jest.Mock).mockResolvedValueOnce({ apexTestClasses: [], nextRecordsUrl: null });
    await Effect.runPromise(discoverTests({ namespacePrefix: 'MyNS' }));
    const firstCallArg = (mockConnection.request as jest.Mock).mock.calls[0][0];
    expect(firstCallArg.url).toContain('namespacePrefix=MyNS');
    expect(firstCallArg.url).toContain('showAllMethods=true');
  });

  it('handles unexpected response shape without throwing', async () => {
    // Missing apexTestClasses entirely
    (mockConnection.request as jest.Mock).mockResolvedValueOnce({ nextRecordsUrl: null });
    const result = await Effect.runPromise(discoverTests());
    expect(result.classes).toEqual([]);
  });
});
