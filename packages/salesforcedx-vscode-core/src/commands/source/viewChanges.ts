/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  EmptyParametersGatherer,
  SfCommandlet,
  SfWorkspaceChecker
} from '../util';
import { SourceTrackingGetStatusExecutor } from './sourceTrackingGetStatusExecutor';

const workspaceChecker = new SfWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();
const getCommandletFor = (
  executor: SourceTrackingGetStatusExecutor
): SfCommandlet<{}> =>
  new SfCommandlet(workspaceChecker, parameterGatherer, executor);

export const viewAllChanges = (): void => {
  const executionName = 'view_all_changes_text';
  const logName = 'view_all_changes';
  const executor = new SourceTrackingGetStatusExecutor(executionName, logName, {
    local: true,
    remote: true
  });
  const commandlet = getCommandletFor(executor);
  void commandlet.run();
};

export const viewLocalChanges = (): void => {
  const executionName = 'view_local_changes_text';
  const logName = 'view_local_changes';
  const executor = new SourceTrackingGetStatusExecutor(executionName, logName, {
    local: true,
    remote: false
  });
  const commandlet = getCommandletFor(executor);
  void commandlet.run();
};

export const viewRemoteChanges = (): void => {
  const executionName = 'view_remote_changes_text';
  const logName = 'view_remote_changes';
  const executor = new SourceTrackingGetStatusExecutor(executionName, logName, {
    local: false,
    remote: true
  });
  const commandlet = getCommandletFor(executor);
  void commandlet.run();
};
