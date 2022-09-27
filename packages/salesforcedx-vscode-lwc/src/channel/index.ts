/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ChannelService } from '@salesforce/salesforcedx-utils-vscode';
import { nls } from '../messages';

export const channelService = ChannelService.getInstance(
  nls.localize('lwc_output_channel_name')
);
