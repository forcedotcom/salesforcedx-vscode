/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core-bundle';
import * as vscode from 'vscode';
import { StatusBarAlignment, StatusBarItem, window } from 'vscode';
import { APEX_CODE_DEBUG_LEVEL, TRACE_FLAG_EXPIRATION_KEY, VISUALFORCE_DEBUG_LEVEL } from '../constants';
import { WorkspaceContextUtil } from '../context/workspaceContextUtil';
import { optionHHmm, optionMMddYYYY } from '../date';
import { nls } from '../messages';

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

/** Generate user-specific key for storing trace flag expiration */
export const getTraceFlagExpirationKey = (userId: string): string => `${TRACE_FLAG_EXPIRATION_KEY}_${userId}`;

export class TraceFlags {
  private readonly LOG_TIMER_LENGTH_MINUTES = 30;
  private readonly MILLISECONDS_PER_MINUTE = 60000;
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public async ensureTraceFlags(): Promise<boolean> {
    const traceFlag = await this.getTraceFlagForUser(await this.getUserIdOrThrow());
    if (traceFlag) {
      // update existing debug level and trace flag
      if (!(await this.updateDebugLevel(traceFlag.DebugLevelId))) {
        return false;
      }

      const expirationDate = this.calculateExpirationDate(
        traceFlag.ExpirationDate ? new Date(traceFlag.ExpirationDate) : new Date()
      );
      return await this.updateTraceFlag(traceFlag.Id, expirationDate);
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

  private async updateDebugLevel(id: string): Promise<boolean> {
    const debugLevel = {
      Id: id,
      ApexCode: APEX_CODE_DEBUG_LEVEL,
      Visualforce: VISUALFORCE_DEBUG_LEVEL
    };
    const result = await this.connection.tooling.update('DebugLevel', debugLevel);
    return result.success;
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

  private async updateTraceFlag(id: string, expirationDate: Date): Promise<boolean> {
    const traceFlag = {
      Id: id,
      StartDate: new Date().toUTCString(),
      ExpirationDate: expirationDate.toUTCString()
    };
    const result = await this.connection.tooling.update('TraceFlag', traceFlag);
    return result.success;
  }

  public async createTraceFlag(
    userId: string,
    debugLevelId: string,
    expirationDate: Date
  ): Promise<string | undefined> {
    const traceFlag = {
      tracedentityid: userId,
      logtype: 'developer_log',
      debuglevelid: debugLevelId,
      StartDate: new Date().toUTCString(),
      ExpirationDate: expirationDate.toUTCString()
    };

    const result = await this.connection.tooling.create('TraceFlag', traceFlag);

    if (result.success && result.id) {
      return result.id;
    } else {
      return undefined;
    }
  }

  private isValidDateLength(expirationDate: Date) {
    const currDate = new Date().valueOf();
    return expirationDate.getTime() - currDate > this.LOG_TIMER_LENGTH_MINUTES * this.MILLISECONDS_PER_MINUTE;
  }

  public calculateExpirationDate(expirationDate: Date): Date {
    if (!this.isValidDateLength(expirationDate)) {
      return new Date(Date.now() + this.LOG_TIMER_LENGTH_MINUTES * this.MILLISECONDS_PER_MINUTE);
    }
    return expirationDate;
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
      SELECT id, logtype, startdate, expirationdate, debuglevelid, debuglevel.apexcode, debuglevel.visualforce, debuglevel.developername
      FROM TraceFlag
      WHERE logtype='DEVELOPER_LOG' AND TracedEntityId='${userId}' AND debuglevel.developername='ReplayDebuggerLevels'
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

  public async handleTraceFlagCleanup(extensionContext: vscode.ExtensionContext): Promise<void> {

    // Change the status bar message to reflect the trace flag expiration date for the new target org

    // If there is a non-expired TraceFlag with DeveloperName 'ReplayDebuggerLevels' for the current user, update the status bar message
    const newTraceFlags = new TraceFlags(await WorkspaceContextUtil.getInstance().getConnection()); // Get the new connection after switching
    const newUserId = await newTraceFlags.getUserIdOrThrow();
    const myTraceFlag = await newTraceFlags.getTraceFlagForUser(newUserId);

    const userSpecificKey = getTraceFlagExpirationKey(newUserId);

    if (!myTraceFlag) {
      extensionContext.workspaceState.update(userSpecificKey, undefined);
      disposeTraceFlagExpiration();
      return;
    }

    const currentTime = new Date();
    if (myTraceFlag.ExpirationDate && new Date(myTraceFlag.ExpirationDate) > currentTime) {
      extensionContext.workspaceState.update(userSpecificKey, myTraceFlag.ExpirationDate);
    } else {
      extensionContext.workspaceState.update(userSpecificKey, undefined);
    }

    // Delete expired TraceFlags for the current user
    const expiredTraceFlagExists = await newTraceFlags.deleteExpiredTraceFlags(newUserId);
    if (expiredTraceFlagExists) {
      extensionContext.workspaceState.update(userSpecificKey, undefined);
    }

    // Apex Replay Debugger Expiration Status Bar Entry
    const expirationDate = extensionContext.workspaceState.get<string>(userSpecificKey);
    if (expirationDate) {
      showTraceFlagExpiration(new Date(expirationDate));
    } else {
      disposeTraceFlagExpiration();
    }
  }
}

let statusBarItem: StatusBarItem | undefined;

export const showTraceFlagExpiration = (expirationDate: Date): void => {
  statusBarItem ??= window.createStatusBarItem(StatusBarAlignment.Left, 40);
  const expirationHHmm = expirationDate.toLocaleTimeString(undefined, optionHHmm);
  statusBarItem.text = nls.localize('apex_debug_log_status_bar_text', expirationHHmm);

  statusBarItem.tooltip = nls.localize(
    'apex_debug_log_status_bar_hover_text',
    APEX_CODE_DEBUG_LEVEL,
    expirationHHmm,
    expirationDate.toLocaleDateString(undefined, optionMMddYYYY)
  );
  statusBarItem.show();
};

export const disposeTraceFlagExpiration = (): void => {
  statusBarItem?.dispose();
  statusBarItem = undefined; // Resetting to undefined to allow re-creation
};
