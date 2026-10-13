/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getOrgAuthFields } from '../../../src/orgs/shared';

jest.mock('node:child_process', () => {
  const exec = jest.fn();
  exec[Symbol.for('nodejs.util.promisify.custom')] = (command: string) =>
    Promise.resolve({
      stdout: JSON.stringify(
        command.includes('show-access-token')
          ? { result: null }
          : { result: { instanceUrl: 'https://example.my.salesforce.com', apiVersion: '68.0' } }
      )
    });
  return { exec };
});

it('reports a missing access token when the CLI returns a null result', async () => {
  await expect(getOrgAuthFields('testOrg')).rejects.toThrow(
    'Org testOrg did not return an instance URL, API version, and access token.'
  );
});
