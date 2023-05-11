/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as sfdx from '../../src/sfdx';

describe('withSFConnection', () => {
  function run(showErrorMessage: boolean) {
    it(`should ${
      showErrorMessage ? '' : 'not '
    } show error message when showErrorMessage=${showErrorMessage}`, async () => {
      const debouncedShowChannelAndErrorMessageSpy = jest.spyOn(
        sfdx,
        'debouncedShowChannelAndErrorMessage'
      );

      await sfdx.withSFConnection(jest.fn(), showErrorMessage);

      expect(debouncedShowChannelAndErrorMessageSpy).toHaveBeenCalledTimes(
        showErrorMessage ? 1 : 0
      );
    });
  }

  run(true);
  run(false);
});
