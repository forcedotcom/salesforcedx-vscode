/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core';
import { APEX_CODE_DEBUG_LEVEL, VISUALFORCE_DEBUG_LEVEL } from '../constants';
import { nls } from '../messages/messages';

type DebugLevelRecord = {
  ApexCode: string;
  VisualForce: string;
  DeveloperName: string;
};

type TraceFlagRecord = {
  Id: string;
  LogType: string;
  DebugLevelId: string;
  StartDate: Date | undefined;
  ExpirationDate: Date | undefined;
  DebugLevel: DebugLevelRecord;
};

/** Update debug level with standard settings */
const updateDebugLevel = async (connection: Connection, id: string): Promise<boolean> => {
  const debugLevel = {
    Id: id,
    ApexCode: APEX_CODE_DEBUG_LEVEL,
    Visualforce: VISUALFORCE_DEBUG_LEVEL
  };
  const result = await connection.tooling.update('DebugLevel', debugLevel);
  return result.success;
};

const LOG_TIMER_LENGTH_MINUTES = 30;
const MILLISECONDS_PER_MINUTE = 60_000;

/** Update trace flag with new start and expiration dates */
const updateTraceFlag = async (connection: Connection, id: string, expirationDate: Date): Promise<boolean> => {
  const traceFlag = {
    Id: id,
    StartDate: new Date().toUTCString(),
    ExpirationDate: expirationDate.toUTCString()
  };
  const result = await connection.tooling.update('TraceFlag', traceFlag);
  return result.success;
};

export class TraceFlags {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public async ensureTraceFlags(): Promise<boolean> {
    const traceFlag = await this.getTraceFlagForUser(await this.getUserIdOrThrow());
    if (traceFlag) {
      // update existing debug level and trace flag
      if (!(await updateDebugLevel(this.connection, traceFlag.DebugLevelId))) {
        return false;
      }

      const expirationDate = this.calculateExpirationDate(
        traceFlag.ExpirationDate ? new Date(traceFlag.ExpirationDate) : new Date()
      );
      return await updateTraceFlag(this.connection, traceFlag.Id, expirationDate);
    } else {
      // create a debug level
      const debugLevelId = await this.getOrCreateDebugLevel();

      // create a trace flag
      const expirationDate = this.calculateExpirationDate(new Date());
      if (!(await this.createTraceFlag(await this.getUserIdOrThrow(), debugLevelId, expirationDate))) {
        return false;
      }
    }

    return true;
  }

  public async getOrCreateDebugLevel(): Promise<string> {
    // Check if a DebugLevel with DeveloperName 'ReplayDebuggerLevels' already exists
    const replayDebuggerLevels = await this.connection.tooling.query(
      "SELECT Id FROM DebugLevel WHERE DeveloperName = 'ReplayDebuggerLevels' LIMIT 1"
    );
    const [firstReplayDebuggerLevel] = replayDebuggerLevels.records;
    if (firstReplayDebuggerLevel?.Id) {
      return firstReplayDebuggerLevel?.Id;
    }

    // Create a new DebugLevel
    const debugLevel = {
      DeveloperName: 'ReplayDebuggerLevels',
      MasterLabel: 'ReplayDebuggerLevels',
      ApexCode: APEX_CODE_DEBUG_LEVEL,
      Visualforce: VISUALFORCE_DEBUG_LEVEL
    };
    const debugLevelResult = await this.connection.tooling.create('DebugLevel', debugLevel);
    if (!debugLevelResult.success) {
      throw new Error(nls.localize('trace_flags_failed_to_create_debug_level'));
    }
    return debugLevelResult.id;
  }

  public async createTraceFlag(
    userId: string,
    debugLevelId: string,
    expirationDate?: Date
  ): Promise<string | undefined> {
    const traceFlag = {
      tracedentityid: userId,
      logtype: 'developer_log',
      debuglevelid: debugLevelId,
      StartDate: new Date().toUTCString(),
      ExpirationDate: expirationDate?.toUTCString() ?? this.calculateExpirationDate(new Date()).toUTCString()
    };

    const result = await this.connection.tooling.create('TraceFlag', traceFlag);

    return result.success && result.id ? result.id : undefined;
  }

  public calculateExpirationDate(expirationDate: Date): Date {
    const currDate = Date.now();
    const isValidLength = expirationDate.getTime() - currDate > LOG_TIMER_LENGTH_MINUTES * MILLISECONDS_PER_MINUTE;
    return !isValidLength ? new Date(Date.now() + LOG_TIMER_LENGTH_MINUTES * MILLISECONDS_PER_MINUTE) : expirationDate;
  }

  public async getUserIdOrThrow(): Promise<string> {
    // if we have a userId in the authFiles, use that, otherwise ask the org for the user for the connection
    const userId = this.connection.getAuthInfoFields().userId ?? (await this.connection.identity()).user_id;
    if (!userId) {
      throw new Error(nls.localize('trace_flags_unknown_user'));
    }
    return userId;
  }

  public async getTraceFlagForUser(userId: string): Promise<TraceFlagRecord | undefined> {
    const traceFlagQuery = `
      SELECT Id, LogType, StartDate, ExpirationDate, DebugLevelId, DebugLevel.ApexCode, DebugLevel.Visualforce, DebugLevel.DeveloperName
      FROM TraceFlag
      WHERE LogType='DEVELOPER_LOG' AND TracedEntityId='${userId}' AND DebugLevel.DeveloperName='ReplayDebuggerLevels'
    `;
    const traceFlagResult = await this.connection.tooling.query<TraceFlagRecord>(traceFlagQuery);

    if (traceFlagResult.totalSize > 0) {
      return traceFlagResult.records[0];
    }
    return undefined;
  }

  public async deleteExpiredTraceFlags(userId: string): Promise<boolean> {
    // If an expired TraceFlag exists, delete it
    const myTraceFlag = await this.getTraceFlagForUser(userId);
    if (!myTraceFlag) {
      return false;
    }
    const currentTime = new Date();
    if (myTraceFlag.ExpirationDate && new Date(myTraceFlag.ExpirationDate) < currentTime) {
      await this.connection.tooling.delete('TraceFlag', myTraceFlag.Id);
      return true;
    }
    return false;
  }
}
