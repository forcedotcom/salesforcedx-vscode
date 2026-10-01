/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { homedir, tmpdir } from 'node:os';
import { AuthInfo } from '@salesforce/core';

describe('AuthInfo access token options', () => {
  it('skips the Dev Hub check when isDevHub is supplied', async () => {
    jest.mocked(homedir).mockReturnValue(tmpdir());
    const determineIfDevHub = jest.spyOn(
      AuthInfo.prototype as unknown as {
        determineIfDevHub: (instanceUrl: string, accessToken: string) => Promise<boolean>;
      },
      'determineIfDevHub'
    );
    determineIfDevHub.mockResolvedValue(true);

    try {
      await AuthInfo.create({
        accessTokenOptions: {
          accessToken: 'test-token',
          loginUrl: 'https://example.my.salesforce.com',
          instanceUrl: 'https://example.my.salesforce.com',
          username: 'web-console-auth-flags@example.com',
          orgId: '00D000000000001',
          namespacePrefix: '',
          isDevHub: false,
          isScratch: false,
          isSandbox: false
        }
      });

      expect(determineIfDevHub).not.toHaveBeenCalled();
    } finally {
      determineIfDevHub.mockRestore();
    }
  });
});
