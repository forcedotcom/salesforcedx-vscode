/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { makeServicesOrg } from '../../src/core/servicesOrgAdapter';

describe('makeServicesOrg adapter', () => {
  it('maps query() to OwnedQueryResult', async () => {
    const queryMock = jest.fn().mockResolvedValue({ done: true, totalSize: 1, records: [{ Id: 'a' }] });
    const fakeConn = {
      getApiVersion: () => '62.0',
      query: queryMock,
      tooling: { query: jest.fn() }
    };
    const org = makeServicesOrg(fakeConn as never);
    const r = await org.query('SELECT Id FROM Account');
    expect(r).toEqual({ done: true, totalSize: 1, records: [{ Id: 'a' }] });
    expect(queryMock).toHaveBeenCalledWith('SELECT Id FROM Account', expect.anything());
  });
  it('routes tooling:true through conn.tooling', async () => {
    const toolingQueryMock = jest.fn().mockResolvedValue({ done: true, totalSize: 2, records: [{ Id: 't' }] });
    const fakeConn = {
      getApiVersion: () => '62.0',
      query: jest.fn(),
      tooling: { query: toolingQueryMock }
    };
    const org = makeServicesOrg(fakeConn as never);
    await org.query('SELECT Id FROM ApexClass', { tooling: true });
    expect(toolingQueryMock).toHaveBeenCalled();
  });
  it('exposes apiVersion', () => {
    const fakeConn = {
      getApiVersion: () => '62.0',
      query: jest.fn(),
      tooling: { query: jest.fn() }
    };
    expect(makeServicesOrg(fakeConn as never).apiVersion).toBe('62.0');
  });
});
