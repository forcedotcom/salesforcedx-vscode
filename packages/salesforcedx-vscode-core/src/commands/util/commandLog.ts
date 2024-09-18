/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CommandEvent, CommandEventStream, CommandEventType } from '@salesforce/salesforcedx-utils-vscode';
import { WorkspaceContext } from '../../context';
import { CommandLogEntry } from './commandLogEntry';

export const getCommandLog = (commandIdFilter?: string, exitCodeFilter?: number): CommandLogEntry[] => {
  return CommandLog.getInstance().getCommandLog(commandIdFilter, exitCodeFilter);
};

export const getLastCommandLogEntry = (commandIdFilter?: string, exitCodeFilter?: number): CommandLogEntry | undefined => {
  const commandLog = CommandLog.getInstance().getCommandLog(commandIdFilter, exitCodeFilter);
  return commandLog.length > 0 ? commandLog[commandLog.length - 1] : undefined;
};

export class CommandLog {
  private static instance: CommandLog;
  private static STORAGE_KEY = 'COMMAND_LOG';
  private static MAX_LOG_ENTRIES = 1000;

  private commandLogEntries: CommandLogEntry[] = [];
  private inProgressCommands: Map<string, number> = new Map();
  private inProgressData: any = {};

  private constructor() {
    this.loadCommandLog();
  }

  public static getInstance(): CommandLog {
    if (!CommandLog.instance) {
      CommandLog.instance = new CommandLog();
    }
    return CommandLog.instance;
  }

  public initialize() {
    CommandEventStream.getInstance().onCommandEvent(this.processCommandEvent.bind(this));
  }

  public async logCommand(commandId: string, duration: number) {
    const entry = {
      commandId,
      timestamp: Date.now(),
      duration,
      exitCode: this.inProgressData.exitCode,
      error: this.inProgressData.error,
      data: this.inProgressData.data
    };
    this.commandLogEntries.push(entry);
    if (this.commandLogEntries.length > CommandLog.MAX_LOG_ENTRIES) {
      this.commandLogEntries.shift();
    }
    await this.updateCommandLog();
  }

  public getCommandLog(commandIdFilter?: string, exitCodeFilter?: number): CommandLogEntry[] {
    let results = Array.from(this.commandLogEntries);
    if (commandIdFilter) {
      results = results.filter(entry => entry.commandId === commandIdFilter);
    }
    if (exitCodeFilter !== undefined) {
      results = results.filter(entry => entry.exitCode === exitCodeFilter);
    }
    return results;
  }

  private loadCommandLog() {
    // load command log from storage
    this.commandLogEntries = WorkspaceContext.getInstance().workspaceState.get<CommandLogEntry[]>(CommandLog.STORAGE_KEY) || [];
  }

  private async updateCommandLog() {
    // save command log to storage
    await WorkspaceContext.getInstance().workspaceState.update(CommandLog.STORAGE_KEY, this.commandLogEntries);
  }

  private async processCommandEvent(event: CommandEvent): Promise<void> {
    switch (event.type) {
      case CommandEventType.START:
        this.inProgressCommands.set(event.commandId, Date.now());
        break;
      case CommandEventType.END:
        {
            const start = this.inProgressCommands.get(event.commandId);
          if (start) {
            const duration = Date.now() - start;
            await this.logCommand(event.commandId, duration);
            this.inProgressCommands.delete(event.commandId);
            if (this.inProgressCommands.size === 0) {
              this.inProgressData = {};
            }
          }
        }
        break;
      case CommandEventType.EXIT_CODE:
        this.inProgressData.exitCode = event.exitCode;
        break;
      case CommandEventType.DATA:
        this.inProgressData.data = { ...this.inProgressData.data, ...event.data };
        break;
      case CommandEventType.ERROR:
        this.inProgressData.error = event.error;
        break;
    }
  }
}
