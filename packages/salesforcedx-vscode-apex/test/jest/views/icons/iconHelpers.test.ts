/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { extensionUris } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { VSCODE_APEX_EXTENSION_NAME } from '../../../../src/constants';
import { iconHelpers, ICONS, IconsEnum } from '../../../../src/views/icons';

describe('iconHelpers Unit Tests.', () => {
  describe('getIconPath()', () => {
    const fakeUri = { filePath: '/some/place/apexy' };
    const fakeIconUri = { filePath: '/all/the/way/to/the/icon.svg' };
    beforeEach(() => {
      jest.spyOn(extensionUris, 'extensionUri').mockReturnValue(fakeUri as unknown as vscode.Uri);
      jest.spyOn(extensionUris, 'join').mockReturnValue(fakeIconUri as unknown as vscode.Uri);
    });

    it('Should return the path for enum value.', () => {
      const iconUri = iconHelpers.getIconPath(IconsEnum.LIGHT_BLUE_BUTTON);
      expect(extensionUris.extensionUri).toHaveBeenCalledWith(VSCODE_APEX_EXTENSION_NAME);
      expect(extensionUris.join).toHaveBeenCalledWith(fakeUri, ICONS[IconsEnum.LIGHT_BLUE_BUTTON]);
      expect(iconUri).toEqual(fakeIconUri);
    });
  });
});
