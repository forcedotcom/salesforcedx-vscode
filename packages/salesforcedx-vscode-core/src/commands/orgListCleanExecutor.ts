/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ContinueResponse, LibraryCommandletExecutor } from '@salesforce/salesforcedx-utils-vscode';
import { OUTPUT_CHANNEL, channelService } from '../channels';
import { nls } from '../messages';

import { displayRemainingOrgs, removeExpiredAndDeletedOrgs } from './orgList';

export class OrgListCleanExecutor extends LibraryCommandletExecutor<{}> {
  constructor() {
    super(nls.localize('org_list_clean_text'), 'org_list_clean', OUTPUT_CHANNEL);
  }

  public async run(_response: ContinueResponse<{}>): Promise<boolean> {
    const removedOrgs = await removeExpiredAndDeletedOrgs();

    if (removedOrgs.length > 0) {
      channelService.appendLine(nls.localize('org_list_clean_success_message', removedOrgs.length));
    } else {
      channelService.appendLine(nls.localize('org_list_clean_no_orgs_message'));
    }

    await displayRemainingOrgs();

    return true;
  }
}
