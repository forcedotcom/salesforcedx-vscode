/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core';
import * as vscode from 'vscode';
import { nls } from '../messages';

import { WorkspaceContextUtil } from '../context/workspaceContextUtil';

interface UserRecord {
  Id: string;
}

interface DebugLevelRecord {
  ApexCode: string;
  VisualForce: string;
}

interface TraceFlagRecord {
  Id: string;
  LogType: string;
  DebugLevelId: string;
  StartDate: Date | undefined;
  ExpirationDate: Date | undefined;
  DebugLevel: DebugLevelRecord;
}

interface DataRecordResult {
  id?: string;
  errors?: any[];
  success: boolean;
}

const newTraceFlagIds = new Array<string>();

export class TraceFlags {
  private readonly LOG_TIMER_LENGTH_MINUTES = 30;
  private readonly MILLISECONDS_PER_MINUTE = 60000;
  private connection: Connection;
  private newTraceFlagId: string | undefined;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public async ensureTraceFlags(): Promise<boolean> {
    const username = this.connection.getUsername();
    if (!username) {
      throw new Error(nls.localize('error_no_default_username'));
    }

    const userRecord = await this.getUserIdOrThrow(username);
    const userId = userRecord.Id;
    const traceFlag = await this.getTraceFlagForUser(userId);
    if (traceFlag) {
      // update existing debug level and trace flag
      if (!(await this.updateDebugLevel(traceFlag.DebugLevelId))) {
        return false;
      }

      const expirationDate = this.calculateExpirationDate(
        traceFlag.ExpirationDate
          ? new Date(traceFlag.ExpirationDate)
          : new Date()
      );
      return await this.updateTraceFlag(traceFlag.Id, expirationDate);
    } else {
      // create a debug level
      const debugLevelId = await this.createDebugLevel();
      if (!debugLevelId) {
        throw new Error(
          nls.localize('trace_flags_failed_to_create_debug_level')
        );
      }

      // create a trace flag
      const expirationDate = this.calculateExpirationDate(new Date());
      if (!(await this.createTraceFlag(userId, debugLevelId, expirationDate))) {
        return false;
      } else {

        /*
        debugger;
        try {
          // two
          vscode.debug.onDidTerminateDebugSession(() => {

            // jab
            debugger;

            // this.deleteNewTraceFlagRecord();
          });
        } catch(e) {
          debugger;
        }
        */
      }
    }

    return true;
  }

  private async updateDebugLevel(id: string): Promise<boolean> {
    const debugLevel = {
      Id: id,
      ApexCode: 'FINEST',
      Visualforce: 'FINER'
    };
    const result = (await this.connection.tooling.update(
      'DebugLevel',
      debugLevel
    )) as DataRecordResult;
    return result.success;
  }

  private async createDebugLevel(): Promise<string | undefined> {
    const developerName = `ReplayDebuggerLevels${Date.now()}`;
    const debugLevel = {
      developerName,
      MasterLabel: developerName,
      ApexCode: 'FINEST',
      Visualforce: 'FINER'
    };
    const result = (await this.connection.tooling.create(
      'DebugLevel',
      debugLevel
    )) as DataRecordResult;
    return result.success && result.id ? result.id : undefined;
  }

  private async updateTraceFlag(
    id: string,
    expirationDate: Date
  ): Promise<boolean> {
    const traceFlag = {
      Id: id,
      StartDate: Date.now(),
      ExpirationDate: expirationDate.toUTCString()
    };
    const result = (await this.connection.tooling.update(
      'TraceFlag',
      traceFlag
    )) as DataRecordResult;
    return result.success;
  }

  private async createTraceFlag(
    userId: string,
    debugLevelId: string,
    expirationDate: Date
  ): Promise<string | undefined> {
    const traceFlag = {
      tracedentityid: userId,
      logtype: 'developer_log',
      debuglevelid: debugLevelId,
      StartDate: Date.now(),
      ExpirationDate: expirationDate.toUTCString()
    };

    const result = (await this.connection.tooling.create(
      'TraceFlag',
      traceFlag
    )) as DataRecordResult;

    // return result.success && result.id ? result.id : undefined;

    if (result.success && result.id) {
      this.newTraceFlagId = result.id;

      // debugger;

      // newTraceFlagIds.push(result.id);

      /*
      debugger;
      try {
        // one
        vscode.debug.onDidTerminateDebugSession(() => {

          // jab
          debugger;

          // this.deleteNewTraceFlagRecord();
        });
      } catch(e) {
        debugger;
      }
      */

      return this.newTraceFlagId;
    } else {
      return undefined;
    }
  }

  private isValidDateLength(expirationDate: Date) {
    const currDate = new Date().valueOf();
    return (
      expirationDate.getTime() - currDate >
      this.LOG_TIMER_LENGTH_MINUTES * this.MILLISECONDS_PER_MINUTE
    );
  }

  private calculateExpirationDate(expirationDate: Date): Date {
    if (!this.isValidDateLength(expirationDate)) {
      expirationDate = new Date(
        Date.now() +
          this.LOG_TIMER_LENGTH_MINUTES * this.MILLISECONDS_PER_MINUTE
      );
    }
    return expirationDate;
  }

  private async getUserIdOrThrow(username: string): Promise<UserRecord> {
    const userQuery = `SELECT id FROM User WHERE username='${username}'`;
    const userResult = await this.connection.query<UserRecord>(userQuery);

    if (!userResult.totalSize || userResult.totalSize === 0) {
      throw new Error(nls.localize('trace_flags_unknown_user'));
    }
    return userResult.records[0];
  }

  private async getTraceFlagForUser(
    userId: string
  ): Promise<TraceFlagRecord | undefined> {
    const traceFlagQuery = `
      SELECT id, logtype, startdate, expirationdate, debuglevelid, debuglevel.apexcode, debuglevel.visualforce
      FROM TraceFlag
      WHERE logtype='DEVELOPER_LOG' AND TracedEntityId='${userId}'
    `;
    const traceFlagResult = await this.connection.tooling.query<
      TraceFlagRecord
    >(traceFlagQuery);

    if (traceFlagResult.totalSize > 0) {
      return traceFlagResult.records[0];
    }
    return undefined;
  }

// ]  public async deleteNewTraceFlagRecord() {
//
//     // jab
//     debugger;
//
//     if (!this.newTraceFlagId) {
//       return;
//     }
//
//     const result = await this.connection.tooling.delete('TraceFlag', this.newTraceFlagId);
//
//     // jab
//     debugger;
//
//     this.newTraceFlagId = undefined;
//   }

  /*
  // darn
  public static async removeNewTraceFlagsMethod() {
    // jab
    debugger;

    const workspaceContext = WorkspaceContextUtil.getInstance();

    const connection = await workspaceContext.getConnection();

    while (newTraceFlagIds.length > 0) {

      // jab
      debugger;

      const newTraceFlagId = newTraceFlagIds.pop();
      if (newTraceFlagId) {
        const result = await connection.tooling.delete('TraceFlag', newTraceFlagId);
      }
    }

    debugger;

  }
  */

}

/*
*/
export async function removeNewTraceFlagsFunc() {
  // jab
  // debugger;

  /*
  const workspaceContext = WorkspaceContextUtil.getInstance();

  const connection = await workspaceContext.getConnection();

  while (newTraceFlagIds.length > 0) {

    // jab
    debugger;

    const newTraceFlagId = newTraceFlagIds.pop();
    if (newTraceFlagId) {
      const result = await connection.tooling.delete('TraceFlag', newTraceFlagId);
    }
  }

  debugger;
  */

}

/*
export async function removeNewTraceFlags() {
  // jab
  debugger;

  const workspaceContext = WorkspaceContextUtil.getInstance();

  const connection = await workspaceContext.getConnection();

  /*
  newTraceFlagIds.forEach((newTraceFlagId) => {

    debugger;

    if (newTraceFlagId) {
      const result = await connection.tooling.delete('TraceFlag', newTraceFlagId);
    }

  });
  *

  /*
  for (let i=0; i<newTraceFlagIds.length; i++) {
    const result = await connection.tooling.delete('TraceFlag', newTraceFlagIds[i]);
  }

  newTraceFlagIds.
  *
  while (newTraceFlagIds.length > 0) {
    const newTraceFlagId = newTraceFlagIds.pop();
    if (newTraceFlagId) {
      const result = await connection.tooling.delete('TraceFlag', newTraceFlagId);
    }
  }

  debugger;
}
*/
