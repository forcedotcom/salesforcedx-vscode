/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OutputChannel, window } from 'vscode';
import { nls } from './messages';

export const APEX_LANGUAGE_SERVER_CHANNEL = window.createOutputChannel(
  nls.localize('client_name')
);
