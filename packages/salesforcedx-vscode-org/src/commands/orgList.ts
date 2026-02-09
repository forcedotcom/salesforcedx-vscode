/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfWorkspaceChecker, SfCommandlet } from '@salesforce/salesforcedx-utils-vscode';
import { nls } from '../messages';
import { PromptConfirmGatherer } from '../parameterGatherers/promptConfirmGatherer';
import { OrgListCleanExecutor } from './orgListCleanExecutor';

export const orgList = (): void => {
  const parameterGatherer = new PromptConfirmGatherer(nls.localize('parameter_gatherer_placeholder_org_list_clean'));
  const executor = new OrgListCleanExecutor();
  const commandlet = new SfCommandlet(new SfWorkspaceChecker(), parameterGatherer, executor);
  void commandlet.run();
};
