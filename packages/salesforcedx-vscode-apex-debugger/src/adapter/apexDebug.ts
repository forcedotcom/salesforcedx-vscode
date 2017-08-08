/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  DebugSession,
  InitializedEvent,
  OutputEvent
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { SessionService } from '../core/sessionService';
import { nls } from '../messages';
import { CommandOutput } from '../utils/commandOutput';
import os = require('os');

export interface LaunchRequestArguments
  extends DebugProtocol.LaunchRequestArguments {
  userIdFilter?: string;
  requestTypeFilter?: string;
  entryPointFilter?: string;
  sfdxProject: string;
}

export class ApexDebug extends DebugSession {
  private static TWO_NL = `${os.EOL}${os.EOL}`;
  protected mySessionService = SessionService.getInstance();
  private sfdxProject: string;

  protected initializeRequest(
    response: DebugProtocol.InitializeResponse,
    args: DebugProtocol.InitializeRequestArguments
  ): void {
    this.sendResponse(response);
    this.sendEvent(new InitializedEvent());
  }

  protected attachRequest(
    response: DebugProtocol.AttachResponse,
    args: DebugProtocol.AttachRequestArguments
  ): void {
    response.success = false;
    this.sendResponse(response);
  }

  protected async launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: LaunchRequestArguments
  ): Promise<void> {
    this.sfdxProject = args.sfdxProject;
    const cmdResponse = await this.mySessionService
      .forProject(args.sfdxProject)
      .withUserFilter(args.userIdFilter)
      .withEntryFilter(args.entryPointFilter)
      .withRequestFilter(args.requestTypeFilter)
      .start();
    if (this.mySessionService.isConnected()) {
      response.success = true;
      this.logToDebugConsole(
        nls.localize('session_started_text', cmdResponse.getId())
      );
    } else {
      response.success = false;
      response.message = cmdResponse.getCmdMsg();
      this.showCommandResult(cmdResponse);
    }
    this.sendResponse(response);
  }

  protected async disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
    args: DebugProtocol.DisconnectArguments
  ): Promise<void> {
    if (this.mySessionService.isConnected()) {
      const cmdResponse = await this.mySessionService.stop();
      if (!this.mySessionService.isConnected()) {
        response.success = true;
        this.logToDebugConsole(
          nls.localize('session_terminated_text', cmdResponse.getId())
        );
      } else {
        response.success = false;
        response.message = cmdResponse.getCmdMsg();
        this.showCommandResult(cmdResponse);
      }
    } else {
      response.success = true;
    }
    this.sendResponse(response);
  }

  private logToDebugConsole(msg: string): void {
    if (msg && msg.length !== 0) {
      this.sendEvent(new OutputEvent(`${msg}${ApexDebug.TWO_NL}`));
    }
  }

  private showCommandResult(cmdResponse: CommandOutput): void {
    if (cmdResponse.getStdOut()) {
      this.sendEvent(
        new OutputEvent(
          `${nls.localize(
            'command_output_help_text'
          )}:${os.EOL}${cmdResponse.getStdOut()}${ApexDebug.TWO_NL}`,
          'stderr'
        )
      );
    }
    if (cmdResponse.getStdErr()) {
      this.sendEvent(
        new OutputEvent(
          `${nls.localize(
            'command_error_help_text'
          )}:${os.EOL}${cmdResponse.getStdErr()}${ApexDebug.TWO_NL}`,
          'stderr'
        )
      );
    }
  }
}

DebugSession.run(ApexDebug);
