/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
import { ICONS } from './iconsEnum';

const VSCODE_APEX_TESTING_EXTENSION_NAME = 'salesforce.salesforcedx-vscode-apex-testing';

/** Get the Uri for an icon located in the resources directory */
export const getIconPath = (key: keyof typeof ICONS): vscode.Uri => {
  // Extension is guaranteed to exist since this code runs inside the extension
  const extension = vscode.extensions.getExtension(VSCODE_APEX_TESTING_EXTENSION_NAME)!;
  return Utils.joinPath(extension.extensionUri, ...ICONS[key]);
};
