/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ChannelService } from '../commands/channelService';
/** Public API returned by Salesforce Org Management `activate()` (same shape as Core extension `channelService`). */
export type SalesforceVSCodeOrgApi = {
  channelService: Pick<ChannelService, 'appendLine' | 'showChannelOutput'>;
};
