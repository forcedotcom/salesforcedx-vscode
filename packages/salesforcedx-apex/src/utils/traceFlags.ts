/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core';
import { nls } from '../i18n';
import {
  DEFAULT_DEBUG_LEVEL_NAME,
  LOG_TIMER_LENGTH_MINUTES,
  LOG_TYPE
} from '../logs';
import {
  IdRecord,
  DataRecordResult,
  QueryRecords,
  TraceFlagRecord
} from './types';
import { MILLISECONDS_PER_MINUTE } from './dateUtil';
import { escapeXml } from './authUtil';

export class TraceFlags {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public async ensureTraceFlags(debugLevelName?: string): Promise<boolean> {
    const username = this.connection.getUsername();
    if (!username) {
      throw new Error(nls.localize('error_no_default_username'));
    }

    const userId = (await this.getUserIdOrThrow(username)).Id;
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
      const debugLevelId = await this.getDebugLevelId(debugLevelName);

      // create a trace flag
      const expirationDate = this.calculateExpirationDate(new Date());
      if (!(await this.createTraceFlag(userId, debugLevelId, expirationDate))) {
        return false;
      }
    }

    return true;
  }

  private async getDebugLevelId(
    debugLevelName: string
  ): Promise<string | undefined> {
    let debugLevelId;
    if (debugLevelName) {
      debugLevelId = await this.findDebugLevel(debugLevelName);
      if (!debugLevelId) {
        throw new Error(
          nls.localize('trace_flags_failed_to_find_debug_level', debugLevelName)
        );
      }
    } else {
      debugLevelId = await this.createDebugLevel(DEFAULT_DEBUG_LEVEL_NAME);
      if (!debugLevelId) {
        throw new Error(
          nls.localize('trace_flags_failed_to_create_debug_level')
        );
      }
    }
    return debugLevelId;
  }

  private async findDebugLevel(
    debugLevelName: string
  ): Promise<string | undefined> {
    const escapedDebugLevel = escapeXml(debugLevelName);
    const query = `SELECT Id FROM DebugLevel WHERE DeveloperName = '${escapedDebugLevel}'`;
    const result = (await this.connection.tooling.query(query)) as QueryRecords;
    return result.totalSize && result.totalSize > 0 && result.records
      ? result.records[0].Id
      : undefined;
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

  private async createDebugLevel(
    debugLevelName: string
  ): Promise<string | undefined> {
    const developerName = debugLevelName;
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
      logtype: LOG_TYPE,
      debuglevelid: debugLevelId,
      StartDate: Date.now(),
      ExpirationDate: expirationDate.toUTCString()
    };

    const result = (await this.connection.tooling.create(
      'TraceFlag',
      traceFlag
    )) as DataRecordResult;
    return result.success && result.id ? result.id : undefined;
  }

  private isValidDateLength(expirationDate: Date): boolean {
    const currDate = Date.now();
    return (
      expirationDate.getTime() - currDate >
      LOG_TIMER_LENGTH_MINUTES * MILLISECONDS_PER_MINUTE
    );
  }

  private calculateExpirationDate(expirationDate: Date): Date {
    if (!this.isValidDateLength(expirationDate)) {
      expirationDate = new Date(
        Date.now() + LOG_TIMER_LENGTH_MINUTES * MILLISECONDS_PER_MINUTE
      );
    }
    return expirationDate;
  }

  private async getUserIdOrThrow(username: string): Promise<IdRecord> {
    const escapedUsername = escapeXml(username);
    const userQuery = `SELECT Id FROM User WHERE username='${escapedUsername}'`;
    const userResult = await this.connection.query<IdRecord>(userQuery);

    if (userResult.totalSize === 0) {
      throw new Error(nls.localize('trace_flags_unknown_user'));
    }
    return userResult.records[0];
  }

  private async getTraceFlagForUser(
    userId: string
  ): Promise<TraceFlagRecord | undefined> {
    const traceFlagQuery = `
      SELECT Id, logtype, startdate, expirationdate, debuglevelid, debuglevel.apexcode, debuglevel.visualforce
      FROM TraceFlag
      WHERE logtype='${LOG_TYPE}' AND TracedEntityId='${userId}'
      ORDER BY CreatedDate DESC
      LIMIT 1
    `;
    const traceFlagResult = await this.connection.tooling.query<
      TraceFlagRecord
    >(traceFlagQuery);

    if (traceFlagResult.totalSize > 0) {
      return traceFlagResult.records[0];
    }
    return undefined;
  }
}
