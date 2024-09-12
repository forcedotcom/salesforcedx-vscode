/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { NudgeOptions } from './nudgeOptions';
import { NotificationService } from './notificationService';
import { TelemetryService } from '..';

const logName = 'nudge_command';

/**
 * A class to nudge users to run a command. This is useful for commands that
 * are prerequisites for other activities, but require a user to trigger.
 * 
 * Nudge messages are displayed as a notification with a button to activate 
 * the command.
 */
export class CommandNudger {
  private options: NudgeOptions;

  public constructor(options: NudgeOptions) {
    this.options = options;
  }

  public async execute(): Promise<void> {
    if (this.options.condition && !this.options.condition()) {
      return;
    }

    const selection = await NotificationService.getInstance().showInformationMessage(this.options.message, this.options.buttonLabel);

    const nudgeWorked = selection === this.options.buttonLabel;
    if (nudgeWorked) {
      vscode.commands.executeCommand(this.options.command);
    }

    // record the nudge result
    TelemetryService.getInstance().sendCommandEvent(logName, undefined, {
      nudgeId: this.options.id,
      nudgeCommand: this.options.command,
      nudgeWorked: nudgeWorked.toString()
    });
  }
}
