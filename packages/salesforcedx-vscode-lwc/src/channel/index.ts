/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ChannelService } from '@salesforce/salesforcedx-utils-vscode';
import { nls } from '../messages';

// Create channel immediately when module loads - this ensures it exists even if activation fails
const channelName = nls.localize('lwc_output_channel_name');
console.log('[LWC] Creating output channel:', channelName);
export const channelService = ChannelService.getInstance(channelName);
