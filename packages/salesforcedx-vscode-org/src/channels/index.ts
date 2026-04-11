/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ChannelService } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { nls } from '../messages';

const channelName = nls.localize('channel_name');

export const channelService = ChannelService.getInstance(channelName);

/** Same channel as {@link channelService}; safe to pass to `extensionContext.subscriptions.push`. */
export const OUTPUT_CHANNEL: vscode.OutputChannel = ChannelService.getChannel(channelName);
