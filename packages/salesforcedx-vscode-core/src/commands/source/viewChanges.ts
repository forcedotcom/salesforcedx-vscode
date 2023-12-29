/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from '../util';
import { SourceTrackingGetStatusExecutor } from './sourceTrackingGetStatusExecutor';

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();
const getCommandletFor = (
  executor: SourceTrackingGetStatusExecutor
): SfdxCommandlet<{}> => {
  return new SfdxCommandlet(workspaceChecker, parameterGatherer, executor);
};

export const viewAllChanges = async (): Promise<void> => {
  const executionName = 'force_source_status_text';
  const logName = 'force_source_status';
  const executor = new SourceTrackingGetStatusExecutor(executionName, logName, {
    local: true,
    remote: true
  });
  const commandlet = getCommandletFor(executor);
  await commandlet.run();
};

export const viewLocalChanges = async (): Promise<void> => {
  const executionName = 'force_source_status_local_text';
  const logName = 'force_source_status_local';
  const executor = new SourceTrackingGetStatusExecutor(executionName, logName, {
    local: true,
    remote: false
  });
  const commandlet = getCommandletFor(executor);
  await commandlet.run();
};

export const viewRemoteChanges = async (): Promise<void> => {
  const executionName = 'force_source_status_remote_text';
  const logName = 'force_source_status_remote';
  const executor = new SourceTrackingGetStatusExecutor(executionName, logName, {
    local: false,
    remote: true
  });
  const commandlet = getCommandletFor(executor);
  await commandlet.run();
};
