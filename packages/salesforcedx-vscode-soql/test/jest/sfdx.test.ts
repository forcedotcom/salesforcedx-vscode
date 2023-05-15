/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OrgInfo } from '@salesforce/salesforcedx-utils';
import * as sfdx from '../../src/sfdx';

describe('sfdx utils', () => {
  let debouncedShowChannelAndErrorMessageSpy;

  beforeEach(() => {
    debouncedShowChannelAndErrorMessageSpy = jest
      .spyOn(sfdx, 'debouncedShowChannelAndErrorMessage')
      .mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('withSFConnection', () => {
    function run(showErrorMessage: boolean) {
      it(`should ${
        showErrorMessage ? '' : 'not '
      } show error message when showErrorMessage=${showErrorMessage}`, async () => {
        await sfdx.withSFConnection(jest.fn(), showErrorMessage);

        expect(debouncedShowChannelAndErrorMessageSpy).toHaveBeenCalledTimes(
          showErrorMessage ? 1 : 0
        );
      });
    }

    run(true);
    run(false);
  });

  describe('onOrgChangeDefaultHandler', () => {
    function run(orgInfo: OrgInfo) {
      const isDefaultOrgSet = !!orgInfo.username;
      const maybeNot = isDefaultOrgSet ? '' : 'not ';

      it(`should ${maybeNot} show connection error message when default org is ${maybeNot} set`, async () => {
        await sfdx.onOrgChangeDefaultHandler(orgInfo);

        expect(debouncedShowChannelAndErrorMessageSpy).toHaveBeenCalledTimes(
          isDefaultOrgSet ? 1 : 0
        );
      });
    }

    run({ username: 'x' } as OrgInfo);
    run({ username: undefined } as OrgInfo);
  });
});
