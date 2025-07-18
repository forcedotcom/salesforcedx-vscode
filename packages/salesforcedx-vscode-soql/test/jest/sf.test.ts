/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OrgInfo } from '@salesforce/salesforcedx-utils';
import * as sf from '../../src/sf';

describe('sf utils', () => {
  let debouncedShowChannelAndErrorMessageSpy;

  beforeEach(() => {
    debouncedShowChannelAndErrorMessageSpy = jest
      .spyOn(sf, 'debouncedShowChannelAndErrorMessage')
      .mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('onOrgChangeDefaultHandler', () => {
    const run = (orgInfo: OrgInfo) => {
      const isDefaultOrgSet = !!orgInfo.username;
      const maybeNot = isDefaultOrgSet ? '' : 'not ';

      it(`should ${maybeNot} show connection error message when default org is ${maybeNot} set`, async () => {
        await sf.onOrgChangeDefaultHandler(orgInfo);

        expect(debouncedShowChannelAndErrorMessageSpy).toHaveBeenCalledTimes(isDefaultOrgSet ? 1 : 0);
      });
    };

    run({ username: 'x' } as OrgInfo);
    run({ username: undefined } as OrgInfo);
  });
});
