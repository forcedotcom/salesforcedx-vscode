/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect, test } from '@salesforce/command/lib/test';
import { ensureJsonMap, ensureString } from '@salesforce/ts-types';

describe('hello:org', () => {
  test
    .withOrg({ username: 'test@org.com' }, true)
    .withConnectionRequest(request => {
      const requestMap = ensureJsonMap(request);
      if (ensureString(requestMap.url).match(/Organization/)) {
        return Promise.resolve({
          records: [
            {
              Name: 'Super Awesome Org',
              TrialExpirationDate: '2018-03-20T23:24:11.000+0000'
            }
          ]
        });
      }
      return Promise.resolve({ records: [] });
    })
    .stdout()
    .command(['hello:org', '--targetusername', 'test@org.com'])
    .it('runs hello:org --targetusername test@org.com', ctx => {
      expect(ctx.stdout).to.contain(
        'Hello world! This is org: Super Awesome Org and I will be around until Tue Mar 20 2018!'
      );
    });
});
