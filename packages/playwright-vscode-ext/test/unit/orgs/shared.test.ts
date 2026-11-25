/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo } from '@salesforce/core';
import type * as SalesforceCore from '@salesforce/core';
import type * as ChildProcess from 'node:child_process';
import { execAsync, getOrgAuthFields } from '../../../src/orgs/shared';

vi.mock('@salesforce/core', async () => ({
  ...(await vi.importActual<typeof SalesforceCore>('@salesforce/core')),
  AuthInfo: { create: vi.fn() }
}));

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof ChildProcess>('node:child_process');
  return {
    ...actual,
    exec: Object.assign(vi.fn(), { [Symbol.for('nodejs.util.promisify.custom')]: vi.fn() })
  };
});

beforeEach(() => {
  vi.mocked(execAsync).mockImplementation(command =>
    Promise.resolve({
      stdout: JSON.stringify(
        command.includes('show-access-token')
          ? { result: { accessToken: 'test-token' } }
          : command.includes('display user')
            ? { result: { id: '005000000000001', orgId: '00D000000000001' } }
            : {
                result: {
                  username: 'test@example.com',
                  instanceUrl: 'https://example.my.salesforce.com',
                  apiVersion: '68.0'
                }
              }
      ),
      stderr: ''
    })
  );
});

it.each([
  { namespacePrefix: null, expectedNamespacePrefix: '' },
  { namespacePrefix: undefined, expectedNamespacePrefix: undefined },
  { namespacePrefix: 'managed', expectedNamespacePrefix: 'managed' }
])(
  'preserves session metadata for namespace $namespacePrefix',
  async ({ namespacePrefix, expectedNamespacePrefix }) => {
    const authInfoCreate = vi.mocked(AuthInfo.create);
    authInfoCreate.mockResolvedValue({
      getFields: () => ({
        username: 'test@example.com',
        orgId: '00D000000000001',
        userId: '005000000000001',
        instanceName: 'USA9S',
        orgEdition: 'Developer',
        namespacePrefix,
        isDevHub: false,
        isScratch: true,
        isSandbox: false,
        accessToken: 'must-not-leak',
        refreshToken: 'must-not-leak'
      })
    } as Awaited<ReturnType<typeof AuthInfo.create>>);

    const result = await getOrgAuthFields('testOrg');

    expect(result.sessionContext.namespacePrefix).toBe(expectedNamespacePrefix);
    expect(result.sessionContext).toMatchObject({
      username: 'test@example.com',
      orgId: '00D000000000001',
      isScratch: true
    });
    expect(JSON.stringify(result.sessionContext)).not.toContain('must-not-leak');
    expect(result.accessToken).toBe('test-token');
  }
);

it('reports a missing access token when the CLI returns a null result', async () => {
  vi.mocked(execAsync).mockImplementation(command =>
    Promise.resolve({
      stdout: JSON.stringify(
        command.includes('show-access-token')
          ? { result: null }
          : command.includes('display user')
            ? { result: { id: '005000000000001', orgId: '00D000000000001' } }
            : {
                result: {
                  username: 'test@example.com',
                  instanceUrl: 'https://example.my.salesforce.com',
                  apiVersion: '68.0'
                }
              }
      ),
      stderr: ''
    })
  );

  await expect(getOrgAuthFields('testOrg')).rejects.toThrow(
    'Org testOrg did not return an instance URL, API version, and access token.'
  );
});

it('reports the CLI user id in session context when AuthInfo has no user id', async () => {
  vi.mocked(AuthInfo.create).mockResolvedValue({
    getFields: () => ({ username: 'test@example.com', orgId: '00D000000000001', userId: undefined })
  } as Awaited<ReturnType<typeof AuthInfo.create>>);

  const result = await getOrgAuthFields('testOrg');

  expect(result.sessionContext.userId).toBe('005000000000001');
  expect(result.sessionContext.orgId).toBe('00D000000000001');
});

it('rejects a deleted existing org before reading its access token', async () => {
  vi.mocked(execAsync).mockResolvedValue({
    stdout: JSON.stringify({
      result: {
        username: 'test@example.com',
        instanceUrl: 'https://example.my.salesforce.com',
        apiVersion: '68.0',
        status: 'Deleted'
      }
    }),
    stderr: ''
  } as Awaited<ReturnType<typeof execAsync>>);

  await expect(getOrgAuthFields('testOrg')).rejects.toThrow('Org testOrg is deleted.');
  expect(execAsync).toHaveBeenCalledOnce();
});
