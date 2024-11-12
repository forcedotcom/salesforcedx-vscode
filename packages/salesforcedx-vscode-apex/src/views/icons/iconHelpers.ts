/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { extensionUris } from '@salesforce/salesforcedx-utils-vscode';
import { VSCODE_APEX_EXTENSION_NAME } from '../../constants';
import { iconKey, ICONS } from './IconsEnum';

/**
 * Get the Uri for an icon located in the resources directory.
 * @param key A key from the {@link IconsEnum}
 * @returns The Uri to the icon image.
 */
const getIconPath = (key: iconKey) => {
  const baseExtensionPath = extensionUris.extensionUri(VSCODE_APEX_EXTENSION_NAME);
  const iconUri = extensionUris.join(baseExtensionPath, ICONS[key]);
  return iconUri;
};

export const iconHelpers = {
  getIconPath
};
