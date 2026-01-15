/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { nls } from '../messages';

export const OUTPUT_CHANNEL = vscode.window.createOutputChannel(nls.localize('channel_name'));

/**
 * Simple channel service that wraps vscode OutputChannel.
 * Replaces ChannelService from @salesforce/salesforcedx-utils-vscode
 */
export const channelService = {
  appendLine: (message: string) => {
    OUTPUT_CHANNEL.appendLine(message);
  },
  show: () => {
    OUTPUT_CHANNEL.show();
  }
};
