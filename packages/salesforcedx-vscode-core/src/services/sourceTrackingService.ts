/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Org, SfProject } from '@salesforce/core';
import {
  getRootWorkspacePath,
  WorkspaceContextUtil
} from '@salesforce/salesforcedx-utils-vscode';
import {
  Row,
  Table
} from '@salesforce/salesforcedx-utils-vscode/out/src/output';
import {
  SourceTracking,
  SourceTrackingOptions
} from '@salesforce/source-tracking';
import { StatusOutputRow } from '@salesforce/source-tracking';

export class SourceTrackingService {
  private _sourceTracking: SourceTracking | undefined;

  public constructor(sourceTracking?: SourceTracking) {
    if (sourceTracking !== undefined) {
      this._sourceTracking = sourceTracking;
    }
  }

  public async createSourceTracking(): Promise<SourceTracking> {
    const origCwd = process.cwd();
    const projectPath = getRootWorkspacePath();
    if (process.cwd() !== projectPath) {
      // Change the environment to get the node process to use
      // the correct current working directory (process.cwd).
      // Without this, process.cwd() returns "'/'" and SourceTracking.create() fails.
      process.chdir(projectPath);
    }

    const connection = await WorkspaceContextUtil.getInstance().getConnection();
    // It is important to pass the connection from WorkspaceContext to
    // Org.create() here.  Without this, core uses its cached version
    // of State Aggregator and the "No auth info found" error can be
    // thrown when deploying or retrieving immediately after creating a
    // default scratch org.
    const org: Org = await Org.create({ connection });
    const project = await SfProject.resolve(projectPath);
    const options: SourceTrackingOptions = {
      org,
      project,
      ignoreLocalCache: true,
      subscribeSDREvents: true,
      ignoreConflicts: false
    };

    const tracking = await SourceTracking.create(options);
    if (process.cwd() !== origCwd) {
      // Change the directory back to the orig dir
      process.chdir(origCwd);
    }
    return tracking;
  }

  public getSourceStatusSummary = async ({
    local = true,
    remote = true
  }): Promise<string> => {
    const statusResponse = await (await this.sourceTracking()).getStatus({
      local,
      remote
    });
    const sourceStatusSummary: SourceStatusSummary = new SourceStatusSummary(
      statusResponse
    );
    return sourceStatusSummary.format();
  };

  private async sourceTracking() {
    if (this._sourceTracking === undefined) {
      this._sourceTracking = await this.createSourceTracking();
    }
    return this._sourceTracking;
  }
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

class SourceStatusSummary {
  constructor(private statusOutputRows: StatusOutputRow[]) {}

  public format(): string {
    const statusResults = this.statusOutputRows.map(row =>
      this.resultConverter(row)
    );

    if (statusResults.length === 0) {
      return 'No local or remote changes found.';
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
    { label: 'STATE', key: 'state' },
    { label: 'FULL NAME', key: 'fullName' },
    { label: 'TYPE', key: 'type' },
    { label: 'PROJECT PATH', key: 'filePath' }
  ];

  private columns = this.statusResults.some(result => result.ignored)
    ? [{ label: 'IGNORED', key: 'ignored' }, ...StatusResultsTable.baseColumns]
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
      ignored:
        result.origin === 'Local' ? (result.ignored ? 'true' : 'false') : '',
      filePath: result.filePath ? result.filePath : ''
    });
  }
}
