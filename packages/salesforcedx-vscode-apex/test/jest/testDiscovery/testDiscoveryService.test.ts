/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { discoverApexTests, TestDiscoveryService } from '../../../src/testDiscovery/testDiscoveryService';

jest.mock('../../../src/coreExtensionUtils', () => ({
  getVscodeCoreExtension: jest.fn().mockResolvedValue({
    exports: {
      services: {
        WorkspaceContext: {
          getInstance: () => ({
            getConnection: jest.fn().mockImplementation(async () => mockConnection)
          })
        }
      }
    }
  })
}));

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

const mockConnection = {
  instanceUrl: 'https://example.com',
  getApiVersion: () => '61.0',
  request: jest.fn()
} as any;

describe('TestDiscoveryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      nextRecordsUrl: '/services/data/v61.0/tooling/tests?nextRecord=ns.OtherClass'
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

    const service = new TestDiscoveryService(mockConnection);
    const result = await service.discover();

    expect(mockConnection.request).toHaveBeenCalledTimes(2);
    expect(result.classes).toHaveLength(2);
    expect(result.classes[0].name).toBe('MyTestClass');
    expect(result.classes[0].testMethods).toHaveLength(2);
    expect(result.classes[1].name).toBe('OtherClass');
    expect(result.classes[1].testMethods).toHaveLength(1);
  });

  it('gracefully returns empty when API returns no classes', async () => {
    (mockConnection.request as jest.Mock).mockResolvedValueOnce({ apexTestClasses: [], nextRecordsUrl: null });
    const service = new TestDiscoveryService(mockConnection);
    const result = await service.discover();
    expect(result.classes).toHaveLength(0);
  });

  it('gracefully returns empty on API error', async () => {
    (mockConnection.request as jest.Mock).mockRejectedValueOnce(new Error('Boom'));
    const service = new TestDiscoveryService(mockConnection);
    const result = await service.discover();
    expect(result.classes).toHaveLength(0);
  });

  it('gracefully returns empty when no default org is available', async () => {
    const result = await discoverApexTests();
    expect(result.classes).toHaveLength(0);
  });
});
