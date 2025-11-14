/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Mocks are hoisted; static import is fine

// Prefer spies over full module mocks for core utils

jest.mock('@salesforce/salesforcedx-utils-vscode', () => {
  const actual = jest.requireActual('@salesforce/salesforcedx-utils-vscode');
  return {
    ...actual,
    ConfigUtil: {
      getTargetOrgOrAlias: jest.fn().mockResolvedValue('test@org')
    }
  };
});

jest.mock('../../../src/telemetry/telemetry', () => {
  const sendEventData = jest.fn();
  return {
    getTelemetryService: () => ({
      sendEventData
    })
  };
});

import * as coreExtensionUtils from '../../../src/coreExtensionUtils';
import { getTelemetryService } from '../../../src/telemetry/telemetry';
import { discoverTests } from '../../../src/testDiscovery/testDiscovery';

const mockConnection = {
  instanceUrl: 'https://example.com',
  getApiVersion: () => '61.0',
  request: jest.fn()
} as any;

describe('TestDiscovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(coreExtensionUtils, 'getVscodeCoreExtension').mockResolvedValue({
      exports: {
        services: {
          WorkspaceContext: {
            getInstance: () => ({
              getConnection: jest.fn().mockImplementation(async () => mockConnection)
            })
          }
        }
      }
    } as any);
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

    const result = await discoverTests();

    expect(result.classes).toHaveLength(2);
    expect(result.classes[0].name).toBe('MyTestClass');
    expect(result.classes[0].testMethods).toHaveLength(2);
    expect(result.classes[1].name).toBe('OtherClass');
    expect(result.classes[1].testMethods).toHaveLength(1);
  });

  it('gracefully returns empty when API returns no classes', async () => {
    (mockConnection.request as jest.Mock).mockResolvedValueOnce({ apexTestClasses: [], nextRecordsUrl: null });
    const result = await discoverTests();
    expect(result.classes).toHaveLength(0);
  });

  it('gracefully returns empty on API error', async () => {
    (mockConnection.request as jest.Mock).mockRejectedValueOnce(new Error('Boom'));
    const result = await discoverTests();
    expect(result.classes).toHaveLength(0);
  });

  it('gracefully returns empty when no default org is available', async () => {
    const result = await discoverTests();
    expect(result.classes).toHaveLength(0);
  });

  it('uses minimum API version 65.0 and defaults showAllMethods=true', async () => {
    (mockConnection.request as jest.Mock).mockResolvedValueOnce({ apexTestClasses: [], nextRecordsUrl: null });
    await discoverTests();
    expect(mockConnection.request).toHaveBeenCalledTimes(1);
    const firstCallArg = (mockConnection.request as jest.Mock).mock.calls[0][0];
    expect(firstCallArg.method).toBe('GET');
    expect(firstCallArg.url).toMatch(/^\/services\/data\/v65\.0\/tooling\/tests\?/);
    expect(firstCallArg.url).toContain('showAllMethods=true');
    expect(firstCallArg.url).not.toContain('namespacePrefix=');
    expect(firstCallArg.url).not.toContain('pageSize=');
  });

  it('passes namespacePrefix, pageSize and showAllMethods=false when provided', async () => {
    (mockConnection.request as jest.Mock).mockResolvedValueOnce({ apexTestClasses: [], nextRecordsUrl: null });
    await discoverTests({ namespacePrefix: 'MyNS', pageSize: 200, showAllMethods: false });
    const firstCallArg = (mockConnection.request as jest.Mock).mock.calls[0][0];
    expect(firstCallArg.url).toContain('namespacePrefix=MyNS');
    expect(firstCallArg.url).toContain('pageSize=200');
    expect(firstCallArg.url).toContain('showAllMethods=false');
  });

  it('emits telemetry for end with class/method counts', async () => {
    const page = {
      apexTestClasses: [
        { id: '01pA', name: 'A', testMethods: [{ name: 'm1' }] },
        { id: '01pB', name: 'B', testMethods: [{ name: 'm2' }, { name: 'm3' }] }
      ],
      nextRecordsUrl: null
    };
    (mockConnection.request as jest.Mock).mockResolvedValueOnce(page);
    await discoverTests();
    const telemetry = getTelemetryService();
    expect(telemetry.sendEventData).toHaveBeenCalledWith(
      'apexTestDiscoveryEnd',
      expect.any(Object),
      expect.objectContaining({ numClasses: 2, numMethods: 3 })
    );
  });

  it('handles unexpected response shape without throwing', async () => {
    // Missing apexTestClasses entirely
    (mockConnection.request as jest.Mock).mockResolvedValueOnce({ nextRecordsUrl: null });
    const result = await discoverTests();
    expect(result.classes).toEqual([]);
  });
});
