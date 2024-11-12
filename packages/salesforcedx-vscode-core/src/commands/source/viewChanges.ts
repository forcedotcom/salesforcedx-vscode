/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EmptyParametersGatherer, SfCommandlet, SfWorkspaceChecker } from '../util';
import { SourceTrackingGetStatusExecutor } from './sourceTrackingGetStatusExecutor';

const workspaceChecker = new SfWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();
const getCommandletFor = (executor: SourceTrackingGetStatusExecutor): SfCommandlet<{}> =>
  new SfCommandlet(workspaceChecker, parameterGatherer, executor);

export const viewAllChanges = (): void => {
  viewChanges('view_all_changes_text', 'view_all_changes', true, true);
};

export const viewLocalChanges = (): void => {
  viewChanges('view_local_changes_text', 'view_local_changes', true, false);
};

export const viewRemoteChanges = (): void => {
  viewChanges('view_remote_changes_text', 'view_remote_changes', false, true);
};

const viewChanges = (executionName: string, logName: string, local: boolean, remote: boolean): void => {
  const executor = new SourceTrackingGetStatusExecutor(executionName, logName, {
    local,
    remote
  });
  const commandlet = getCommandletFor(executor);
  void commandlet.run();
};
