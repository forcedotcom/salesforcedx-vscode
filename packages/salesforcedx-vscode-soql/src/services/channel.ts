/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { nls } from '../messages';

const OUTPUT_CHANNEL = vscode.window.createOutputChannel(nls.localize('soql_channel_name'));

export const channelService = {
  appendLine: (msg: string) => OUTPUT_CHANNEL.appendLine(msg),
  clear: () => OUTPUT_CHANNEL.clear(),
  show: () => OUTPUT_CHANNEL.show(true)
};
