/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection, Org, SfProject } from '@salesforce/core';
import { RetrieveResult } from '@salesforce/source-deploy-retrieve';
import {
  SourceTracking,
  SourceTrackingOptions,
  StatusOutputRow
} from '@salesforce/source-tracking';
import { WorkspaceContextUtil } from '../context/workspaceContextUtil';
import { nls } from '../messages';
import { Row, Table } from '../output';
import { getRootWorkspacePath } from '../workspaces';

export type SourceTrackingType = SourceTracking;
export type StatusOutputRowType = StatusOutputRow;

export class SourceTrackingService {
  /**
   * @description creates an instance of SourceTracking with options
   * configured to work in VSCE.
   * Since SourceTracking is initialized with an SfProject, which
   * contains the project path, and PR #4643 made it so that VSCE is
   * running with process.cwd set as the project root, there
   * is no need to call process.chdir here as has been done in VSCE
   * with other core types like Config and ConfigAggregator.
   */
  public static async createSourceTracking(
    projectPath: string,
    connection: Connection
  ): Promise<SourceTracking> {
    const project = await SfProject.resolve(projectPath);
    const org = await Org.create({ connection });
    const options: SourceTrackingOptions = {
      org,
      project,
      ignoreLocalCache: true,
      subscribeSDREvents: true,
      ignoreConflicts: true
    };
    const sourceTracking = await SourceTracking.create(options);
    return sourceTracking;
  }

  public static async updateSourceTrackingAfterRetrieve(
    sourceTracking: SourceTracking,
    result: RetrieveResult
  ) {
    await sourceTracking.updateTrackingFromRetrieve(result);
  }

  public static async getSourceStatusSummary({
    local = true,
    remote = true
  }): Promise<string> {
    const sourceTracking = await getSourceTrackingForCurrentProject();
    const statusResponse = await sourceTracking.getStatus({
      local,
      remote
    });
    const sourceStatusSummary: SourceStatusSummary = new SourceStatusSummary(
      statusResponse
    );
    return sourceStatusSummary.format();
  }

  public static async getLocalStatus(): Promise<StatusOutputRow[]> {
    const sourceTracking = await getSourceTrackingForCurrentProject();
    const statusResponse = await sourceTracking.getStatus({
      local: true,
      remote: false
    });
    return statusResponse;
  }

  public static async getRemoteStatus(): Promise<StatusOutputRow[]> {
    const sourceTracking = await getSourceTrackingForCurrentProject();
    const statusResponse = await sourceTracking.getStatus({
      local: false,
      remote: true
    });
    return statusResponse;
  }
}

async function getSourceTrackingForCurrentProject(): Promise<SourceTracking> {
  const rootWorkspacePath = getRootWorkspacePath();
  const workspaceContext = WorkspaceContextUtil.getInstance();
  const connection = await workspaceContext.getConnection();
  const sourceTracking = await SourceTrackingService.createSourceTracking(
    rootWorkspacePath,
    connection
  );
  return sourceTracking;
}

type StatusActualState = 'Deleted' | 'Add' | 'Changed' | 'Unchanged';
type StatusOrigin = 'Local' | 'Remote';

interface StatusResult {
  state: string;
  fullName: string;
  type: string;
  filePath?: string;
  ignored?: boolean;
  conflict?: boolean;
  actualState?: StatusActualState;
  origin: StatusOrigin;
}

interface FormattedStatusResult {
  state: string;
  fullName: string;
  type: string;
  filePath?: string;
  ignored?: string;
}

export class SourceStatusSummary {
  constructor(private statusOutputRows: StatusOutputRow[]) {}

  public format(): string {
    const statusResults = this.statusOutputRows.map(row =>
      this.resultConverter(row)
    );

    if (statusResults.length === 0) {
      return nls.localize('no_local_or_remote_changes_found');
    }

    const sortedStatusResults = statusResults.sort(this.rowSortFunction);

    return new StatusResultsTable(sortedStatusResults).value();
  }

  /**
   * STL provides a more useful json output.
   * This function makes it consistent with the Status command's json.
   */
  private resultConverter = (input: StatusOutputRow): StatusResult => {
    const { fullName, type, ignored, filePath, conflict } = input;
    const origin = SourceStatusSummary.originMap.get(input.origin) || 'Local';
    const actualState = SourceStatusSummary.stateMap.get(input.state);
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

  private static originMap = new Map<
    StatusOutputRow['origin'],
    StatusResult['origin']
  >([
    ['local', 'Local'],
    ['remote', 'Remote']
  ]);

  private static stateMap = new Map<
    StatusOutputRow['state'],
    StatusResult['actualState']
  >([
    ['delete', 'Deleted'],
    ['add', 'Add'],
    ['modify', 'Changed'],
    ['nondelete', 'Changed']
  ]);

  // sort order is state, type, fullname
  private rowSortFunction = (a: StatusResult, b: StatusResult): number => {
    if (a.state.toLowerCase() === b.state.toLowerCase()) {
      if (a.type.toLowerCase() === b.type.toLowerCase()) {
        return a.fullName.toLowerCase() < b.fullName.toLowerCase() ? -1 : 1;
      }
      return a.type.toLowerCase() < b.type.toLowerCase() ? -1 : 1;
    }
    return a.state.toLowerCase() < b.state.toLowerCase() ? -1 : 1;
  };
}

class StatusResultsTable {
  private static baseColumns = [
    { label: nls.localize('state'), key: 'state' },
    { label: nls.localize('full_name'), key: 'fullName' },
    { label: nls.localize('type'), key: 'type' },
    { label: nls.localize('project_path'), key: 'filePath' }
  ];

  private columns = this.statusResults.some(result => result.ignored)
    ? [
        { label: nls.localize('ignored'), key: 'ignored' },
        ...StatusResultsTable.baseColumns
      ]
    : StatusResultsTable.baseColumns;

  constructor(private statusResults: StatusResult[]) {}

  public value(): string {
    this.statusResults.forEach(statusResult =>
      this.convertToTableRow(statusResult)
    );

    const table: string = new Table().createTable(
      (this.statusResults as unknown) as Row[],
      this.columns
    );

    return table;
  }

  private convertToTableRow(result: StatusResult): FormattedStatusResult {
    return Object.assign(result, {
      ignored: result.ignored ? 'true' : 'false',
      filePath: result.filePath ? result.filePath : ''
    });
  }
}
