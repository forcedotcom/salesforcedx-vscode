/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import type { DeployResult, RetrieveResult } from '@salesforce/source-deploy-retrieve';
import type { SourceTracking, StatusOutputRow } from '@salesforce/source-tracking' with { 'resolution-mode': 'import' };
import { WorkspaceContextUtil } from '../context/workspaceContextUtil';
import { nls } from '../messages/messages';
import { createTable } from '../output/table';
import { SourceTrackingProvider } from '../providers/sourceTrackingProvider';
import { getRootWorkspacePath } from '../workspaces/workspaceUtils';

export type SourceTrackingType = SourceTracking;

export class SourceTrackingService {
  /**
   * Gets the Source Tracking instance for this project
   * from the Source Tracking Provider.
   */
  public static async getSourceTracking(
    projectPath: string,
    connection: Connection,
    ignoreConflicts?: boolean
  ): Promise<SourceTracking> {
    const provider = SourceTrackingProvider.getInstance();
    const tracker = provider.getSourceTracker(projectPath, connection, ignoreConflicts);
    return tracker;
  }

  /**
   * Clears the cached source tracking instance for a specific project and connection.
   * This is useful to force a fresh source tracking instance, particularly for pull operations
   * where stale remote tracking data might cause issues.
   */
  public static clearSourceTracking(projectPath: string, connection: Connection): void {
    const provider = SourceTrackingProvider.getInstance();
    provider.clearSourceTracker(projectPath, connection);
  }

  public static async updateSourceTrackingAfterRetrieve(sourceTracking: SourceTracking, result: RetrieveResult) {
    await sourceTracking.updateTrackingFromRetrieve(result);
  }

  public static async updateSourceTrackingAfterDeploy(sourceTracking: SourceTracking, result: DeployResult) {
    await sourceTracking.updateTrackingFromDeploy(result);
  }

  public static async getSourceStatusSummary({ local = true, remote = true }): Promise<string> {
    const sourceTracking = await getSourceTrackingForCurrentProject();
    const statusResponse = await sourceTracking.getStatus({
      local,
      remote
    });
    return formatSourceStatusSummary(statusResponse);
  }
}

const getSourceTrackingForCurrentProject = async (): Promise<SourceTracking> => {
  const rootWorkspacePath = getRootWorkspacePath();
  const workspaceContext = WorkspaceContextUtil.getInstance();
  const connection = await workspaceContext.getConnection();
  const sourceTrackingProvider = SourceTrackingProvider.getInstance();
  const sourceTracking = await sourceTrackingProvider.getSourceTracker(rootWorkspacePath, connection);
  return sourceTracking;
};

type StatusActualState = 'Deleted' | 'Add' | 'Changed' | 'Unchanged';
type StatusOrigin = 'Local' | 'Remote';

type StatusResult = {
  state: string;
  fullName: string;
  type: string;
  filePath?: string;
  ignored?: boolean;
  conflict?: boolean;
  actualState?: StatusActualState;
  origin: StatusOrigin;
};

type FormattedStatusResult = {
  state: string;
  fullName: string;
  type: string;
  filePath?: string;
  ignored?: string;
};

const formatSourceStatusSummary = (statusOutputRows: StatusOutputRow[]): string =>
  statusOutputRows.length === 0
    ? nls.localize('no_local_or_remote_changes_found')
    : createTable(
        statusOutputRows
          .map(row => convertStatusOutputRow(row))
          .toSorted(sortStatusResults)
          .map(statusResult => convertToTableRow(statusResult)),
        statusOutputRows.some(result => result.ignored)
          ? [{ label: nls.localize('ignored'), key: 'ignored' }, ...TABLE_COLUMNS]
          : TABLE_COLUMNS
      );

const originMap = new Map<StatusOutputRow['origin'], StatusResult['origin']>([
  ['local', 'Local'],
  ['remote', 'Remote']
]);

const stateMap = new Map<StatusOutputRow['state'], StatusResult['actualState']>([
  ['delete', 'Deleted'],
  ['add', 'Add'],
  ['modify', 'Changed'],
  ['nondelete', 'Changed']
]);

/**
 * STL provides a more useful json output.
 * This function makes it consistent with the Status command's json.
 */
const convertStatusOutputRow = (input: StatusOutputRow): StatusResult => {
  const { fullName, type, ignored, filePath, conflict } = input;
  const origin = originMap.get(input.origin) ?? 'Local';
  const actualState = stateMap.get(input.state);
  return {
    fullName,
    type,
    // this string became the place to store information.
    // The JSON now breaks out that info but preserves this property for backward compatibility
    state: `${origin} ${actualState}${conflict ? ' (Conflict)' : ''}`,
    ignored,
    filePath,
    origin,
    actualState,
    conflict
  };
};

/** sort order is state, type, fullname */
const sortStatusResults = (a: StatusResult, b: StatusResult): number => {
  if (a.state.toLowerCase() === b.state.toLowerCase()) {
    if (a.type.toLowerCase() === b.type.toLowerCase()) {
      return a.fullName.toLowerCase() < b.fullName.toLowerCase() ? -1 : 1;
    }
    return a.type.toLowerCase() < b.type.toLowerCase() ? -1 : 1;
  }
  return a.state.toLowerCase() < b.state.toLowerCase() ? -1 : 1;
};

const convertToTableRow = (result: StatusResult): FormattedStatusResult => ({
  ...result,
  ignored: result.ignored ? 'true' : 'false',
  filePath: result.filePath ?? ''
});

const TABLE_COLUMNS = [
  { label: nls.localize('state'), key: 'state' },
  { label: nls.localize('full_name'), key: 'fullName' },
  { label: nls.localize('type'), key: 'type' },
  { label: nls.localize('project_path'), key: 'filePath' }
];
