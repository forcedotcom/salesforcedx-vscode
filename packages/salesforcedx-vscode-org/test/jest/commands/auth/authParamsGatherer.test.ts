/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthParamsGatherer, DEFAULT_ALIAS } from '../../../../src/commands/auth/authParamsGatherer';

describe('AuthParamsGatherer', () => {
  describe('programmatic instance URL (access-token re-auth flow)', () => {
    const instanceUrl = 'https://demo.my.salesforce.com';

    it('uses reauthAliasOrUsername for --alias when provided', async () => {
      const gatherer = new AuthParamsGatherer(instanceUrl, 'demoOrg');
      const result = await gatherer.gather();
      expect(result).toEqual({
        type: 'CONTINUE',
        data: { alias: 'demoOrg', loginUrl: instanceUrl }
      });
    });

    it('trims reauthAliasOrUsername', async () => {
      const gatherer = new AuthParamsGatherer(instanceUrl, '  demoOrg  ');
      const result = await gatherer.gather();
      expect(result).toEqual({
        type: 'CONTINUE',
        data: { alias: 'demoOrg', loginUrl: instanceUrl }
      });
    });

    it('falls back to reauth-{DEFAULT_ALIAS} when reauthAliasOrUsername is omitted', async () => {
      const gatherer = new AuthParamsGatherer(instanceUrl);
      const result = await gatherer.gather();
      expect(result).toEqual({
        type: 'CONTINUE',
        data: { alias: `reauth-${DEFAULT_ALIAS}`, loginUrl: instanceUrl }
      });
    });

    it('falls back to reauth-{DEFAULT_ALIAS} when reauthAliasOrUsername is blank', async () => {
      const gatherer = new AuthParamsGatherer(instanceUrl, '   ');
      const result = await gatherer.gather();
      expect(result).toEqual({
        type: 'CONTINUE',
        data: { alias: `reauth-${DEFAULT_ALIAS}`, loginUrl: instanceUrl }
      });
    });
  });
});
