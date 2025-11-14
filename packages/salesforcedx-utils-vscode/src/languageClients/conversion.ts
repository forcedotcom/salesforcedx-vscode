/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Uri } from 'vscode';

// See https://github.com/Microsoft/vscode-languageserver-node/issues/105
export const code2ProtocolConverter = (value: Uri) =>
  /^win32/.test(process.platform) ? value.toString().replace('%3A', ':') : value.toString();
