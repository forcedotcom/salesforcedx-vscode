/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

export enum CommandEventType {
  START = 'start',
  END = 'end',
  EXIT_CODE = 'exitCode',
  DATA = 'data',
  ERROR = 'error'
}

export type CommandEventStart = {
  type: CommandEventType.START;
  commandId: string;
};

export type CommandEventEnd = {
  type: CommandEventType.END;
  commandId: string;
};

export type CommandEventExitCode = {
  type: CommandEventType.EXIT_CODE;
  exitCode: number;
};

export type CommandEventData = {
  type: CommandEventType.DATA;
  data: any;
};

export type CommandEventError = {
  type: CommandEventType.ERROR;
  error: string;
};

export type CommandEvent = CommandEventStart | CommandEventEnd | CommandEventExitCode | CommandEventData | CommandEventError;

export class CommandEventStream {
  private static instance: CommandEventStream;
  private readonly eventEmitter = new vscode.EventEmitter<CommandEvent>();

  private constructor() {}

  public static getInstance(): CommandEventStream {
    if (!CommandEventStream.instance) {
      CommandEventStream.instance = new CommandEventStream();
    }
    return CommandEventStream.instance;
  }

  public initialize(extensionContext: vscode.ExtensionContext) {
    extensionContext.subscriptions.push(this.eventEmitter);
  }

  public readonly onCommandEvent: vscode.Event<CommandEvent> = this.eventEmitter.event;

  public post(event: CommandEvent) {
    this.eventEmitter.fire(event);
  }
}
