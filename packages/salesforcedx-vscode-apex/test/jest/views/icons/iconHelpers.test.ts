/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { extensionUris } from '@salesforce/salesforcedx-utils-vscode';
import { URI } from 'vscode-uri';
import { VSCODE_APEX_EXTENSION_NAME } from '../../../../src/constants';
import { iconHelpers, IconsEnum } from '../../../../src/views/icons';

describe('iconHelpers Unit Tests.', () => {
  describe('getIconPath()', () => {
    const fakeUri = URI.file('/some/place/apexy');
    beforeEach(() => {
      jest.spyOn(extensionUris, 'extensionUri').mockReturnValue(fakeUri);
    });

    it('Should return the path for enum value.', () => {
      const iconUri = iconHelpers.getIconPath(IconsEnum.LIGHT_BLUE_BUTTON);
      expect(extensionUris.extensionUri).toHaveBeenCalledWith(VSCODE_APEX_EXTENSION_NAME);
      expect(iconUri.path).toEqual('/some/place/apexy/resources/light/testNotRun.svg');
    });
  });
});
