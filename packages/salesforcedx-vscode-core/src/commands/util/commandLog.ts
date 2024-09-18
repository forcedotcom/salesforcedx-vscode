/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { WorkspaceContext } from '../../context';
import { CommandLogEntry } from './commandLogEntry';

export const logCommand = async (commandId: string, duration: number): Promise<void> => {
  await CommandLog.getInstance().logCommand(commandId, duration);
};

export const getCommandLog = (commandIdFilter?: string): CommandLogEntry[] => {
  return CommandLog.getInstance().getCommandLog(commandIdFilter);
};

export const getLastCommandLogEntry = (commandIdFilter?: string): CommandLogEntry | undefined => {
  const commandLog = CommandLog.getInstance().getCommandLog(commandIdFilter);
  return commandLog.length > 0 ? commandLog[commandLog.length - 1] : undefined;
};

class CommandLog {
  private static instance: CommandLog;
  private static STORAGE_KEY = 'COMMAND_LOG';
  private static MAX_LOG_ENTRIES = 1000;

  private commandLogEntries: CommandLogEntry[] = [];

  private constructor() {
    this.loadCommandLog();
  }

  public static getInstance(): CommandLog {
    if (!CommandLog.instance) {
      CommandLog.instance = new CommandLog();
    }
    return CommandLog.instance;
  }

  public async logCommand(commandId: string, duration: number) {
    const timestamp = Date.now();
    this.commandLogEntries.push({ commandId, timestamp, duration });
    if (this.commandLogEntries.length > CommandLog.MAX_LOG_ENTRIES) {
      this.commandLogEntries.shift();
    }
    await this.updateCommandLog();
  }

  public getCommandLog(commandIdFilter?: string): CommandLogEntry[] {
    return this.commandLogEntries.filter(entry => entry.commandId === commandIdFilter);
  }

  private loadCommandLog() {
    // load command log from storage
    this.commandLogEntries = WorkspaceContext.getInstance().workspaceState.get<CommandLogEntry[]>(CommandLog.STORAGE_KEY) || [];
  }

  private async updateCommandLog() {
    // save command log to storage
    await WorkspaceContext.getInstance().workspaceState.update(CommandLog.STORAGE_KEY, this.commandLogEntries);
  }
}
