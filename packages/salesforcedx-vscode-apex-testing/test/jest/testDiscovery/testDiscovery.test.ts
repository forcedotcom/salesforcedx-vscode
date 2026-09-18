/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Mocks are hoisted; static import is fine

vi.mock('../../../src/services/extensionProvider', async () => {
  const EffectLib = await vi.importActual<typeof import('effect/Effect')>('effect/Effect');
  const Context = await vi.importActual<typeof import('effect/Context')>('effect/Context');
  const Layer = await vi.importActual<typeof import('effect/Layer')>('effect/Layer');
  const ManagedRuntime = await vi.importActual<typeof import('effect/ManagedRuntime')>('effect/ManagedRuntime');

  const MockExtensionProviderService = Context.GenericTag('ExtensionProviderService');

  // This will be set by tests via __setMockConnection
  let mockConnectionRef: any;

  // Mock ConnectionService as a class-like object with static accessor method
  const MockConnectionService = {
    getConnection: () => EffectLib.succeed(mockConnectionRef)
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
    AllServicesLayer: MockAllServicesLayer,
    getApexTestingRuntime: () => ManagedRuntime.make(MockAllServicesLayer),
    // Export a function to set the mock connection
    __setMockConnection: (conn: any) => {
      mockConnectionRef = conn;
    }
  };
});

import type { Mock as VitestMock } from 'vitest';
import * as Option from 'effect/Option';
import * as extensionProvider from '../../../src/services/extensionProvider';
import { discoverTests } from '../../../src/testDiscovery/testDiscovery';

const mockConnection = {
  instanceUrl: 'https://example.com',
  getApiVersion: () => '61.0',
  request: vi.fn()
} as any;

describe('TestDiscovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    (mockConnection.request as VitestMock).mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);

    const result = await extensionProvider.getApexTestingRuntime().runPromise(discoverTests());

    expect(result.classes).toHaveLength(2);
    expect(result.classes[0].name).toBe('MyTestClass');
    expect(result.classes[0].testMethods).toHaveLength(2);
    expect(result.classes[1].name).toBe('OtherClass');
    expect(result.classes[1].testMethods).toHaveLength(1);
  });

  it('decodes wire "" sentinels to Option.none() and non-empty prefixes to Option.some()', async () => {
    (mockConnection.request as VitestMock).mockResolvedValueOnce({
      apexTestClasses: [
        { id: '', name: 'DefaultNsClass', namespacePrefix: '', testMethods: [{ name: 'testOne' }] },
        { id: '01pFLOW', name: 'FlowClass', namespacePrefix: 'FlowTesting', testMethods: [{ name: 'testTwo' }] }
      ],
      nextRecordsUrl: null
    });

    const result = await extensionProvider.getApexTestingRuntime().runPromise(discoverTests());

    expect(result.classes[0].id).toEqual(Option.none());
    expect(result.classes[0].namespacePrefix).toEqual(Option.none());
    expect(result.classes[1].id).toEqual(Option.some('01pFLOW'));
    expect(result.classes[1].namespacePrefix).toEqual(Option.some('FlowTesting'));
  });

  it('gracefully returns empty when API returns no classes', async () => {
    (mockConnection.request as VitestMock).mockResolvedValueOnce({ apexTestClasses: [], nextRecordsUrl: null });
    const result = await extensionProvider.getApexTestingRuntime().runPromise(discoverTests());
    expect(result.classes).toHaveLength(0);
  });

  it('handles API errors', async () => {
    (mockConnection.request as VitestMock).mockRejectedValueOnce(new Error('Boom'));
    await expect(extensionProvider.getApexTestingRuntime().runPromise(discoverTests())).rejects.toThrow(
      'Failed to fetch test discovery page: Boom'
    );
  });

  it('uses minimum API version 65.0 and sets showAllMethods=true below v68', async () => {
    (mockConnection.request as VitestMock).mockResolvedValueOnce({ apexTestClasses: [], nextRecordsUrl: null });
    await extensionProvider.getApexTestingRuntime().runPromise(discoverTests());
    expect(mockConnection.request).toHaveBeenCalledTimes(1);
    const firstCallArg = (mockConnection.request as VitestMock).mock.calls[0][0];
    expect(firstCallArg.method).toBe('GET');
    expect(firstCallArg.url).toMatch(/^\/services\/data\/v65\.0\/tooling\/tests\?/);
    expect(firstCallArg.url).toContain('showAllMethods=true');
    expect(firstCallArg.url).not.toContain('namespacePrefix=');
  });

  it('omits showAllMethods and sets testLevel=RunAllTestsInOrg on v68.0', async () => {
    (extensionProvider as any).__setMockConnection({ ...mockConnection, getApiVersion: () => '68.0' });
    (mockConnection.request as VitestMock).mockResolvedValueOnce({ apexTestClasses: [], nextRecordsUrl: null });
    await extensionProvider.getApexTestingRuntime().runPromise(discoverTests());
    const firstCallArg = (mockConnection.request as VitestMock).mock.calls[0][0];
    expect(firstCallArg.url).toMatch(/^\/services\/data\/v68\.0\/tooling\/tests\?/);
    expect(firstCallArg.url).toContain('testLevel=RunAllTestsInOrg');
    expect(firstCallArg.url).not.toContain('showAllMethods');
  });

  it('keeps showAllMethods=true just under the gate on v67.9', async () => {
    (extensionProvider as any).__setMockConnection({ ...mockConnection, getApiVersion: () => '67.9' });
    (mockConnection.request as VitestMock).mockResolvedValueOnce({ apexTestClasses: [], nextRecordsUrl: null });
    await extensionProvider.getApexTestingRuntime().runPromise(discoverTests());
    const firstCallArg = (mockConnection.request as VitestMock).mock.calls[0][0];
    expect(firstCallArg.url).toContain('showAllMethods=true');
    expect(firstCallArg.url).not.toContain('testLevel');
  });

  it('sets testLevel=RunAllTestsInOrg above the gate on v69.0 (>=, not ==68)', async () => {
    (extensionProvider as any).__setMockConnection({ ...mockConnection, getApiVersion: () => '69.0' });
    (mockConnection.request as VitestMock).mockResolvedValueOnce({ apexTestClasses: [], nextRecordsUrl: null });
    await extensionProvider.getApexTestingRuntime().runPromise(discoverTests());
    const firstCallArg = (mockConnection.request as VitestMock).mock.calls[0][0];
    expect(firstCallArg.url).toContain('testLevel=RunAllTestsInOrg');
    expect(firstCallArg.url).not.toContain('showAllMethods');
  });

  it('passes namespacePrefix when provided', async () => {
    (mockConnection.request as VitestMock).mockResolvedValueOnce({ apexTestClasses: [], nextRecordsUrl: null });
    await extensionProvider.getApexTestingRuntime().runPromise(discoverTests({ namespacePrefix: 'MyNS' }));
    const firstCallArg = (mockConnection.request as VitestMock).mock.calls[0][0];
    expect(firstCallArg.url).toContain('namespacePrefix=MyNS');
    expect(firstCallArg.url).toContain('showAllMethods=true');
  });

  it('handles unexpected response shape without throwing', async () => {
    // Missing apexTestClasses entirely
    (mockConnection.request as VitestMock).mockResolvedValueOnce({ nextRecordsUrl: null });
    const result = await extensionProvider.getApexTestingRuntime().runPromise(discoverTests());
    expect(result.classes).toEqual([]);
  });
});
