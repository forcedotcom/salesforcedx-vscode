/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { EventEmitter } from 'events';
import {
  CloseAction,
  CloseHandlerResult,
  ErrorAction,
  ErrorHandler,
  ErrorHandlerResult,
  Message
} from 'vscode-languageclient/node';

export class ApexErrorHandler extends EventEmitter implements ErrorHandler {
  private restarts: number[];
  private hasStarted: boolean = false;
  constructor() {
    super();
    this.restarts = [];
  }
  // TODO: when does error get called instead of closed?
  public error(error: Error, message: Message, count: number): ErrorHandlerResult {
    if (count && count <= 3) {
      this.emit('error', `Error: ${JSON.stringify(error)} ${message.jsonrpc}`);
      return { action: ErrorAction.Continue };
    }
    this.emit('error', `Error: ${JSON.stringify(error)} ${message.jsonrpc}`);
    return { action: ErrorAction.Shutdown };
  }
  // Closed is called when the server processes closes/quits
  public closed(): CloseHandlerResult {
    if (this.hasStarted) {
      this.restarts = [Date.now()];
      this.emit('restarting', 1);
      this.hasStarted = false;
      return { action: CloseAction.Restart };
    }
    this.restarts.push(Date.now());
    if (this.restarts.length < 5) {
      this.emit('restarting', this.restarts.length);
      return { action: CloseAction.Restart };
    } else {
      const diff = this.restarts[this.restarts.length - 1] - this.restarts[this.restarts.length - 5];
      // 3 minutes
      if (diff <= 3 * 60 * 1000) {
        this.emit('startFailed', this.restarts.length);
        return { action: CloseAction.DoNotRestart };
      } else {
        this.restarts.shift();
        this.emit('restarting', this.restarts.length);
        return { action: CloseAction.Restart };
      }
    }
  }
  public serviceHasStartedSuccessfully() {
    this.hasStarted = true;
  }
}
