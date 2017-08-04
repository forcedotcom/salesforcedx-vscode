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

export interface LaunchRequestArguments
  extends DebugProtocol.LaunchRequestArguments {
  userIdFilter: string;
  requestTypeFilter: string;
  entryPointFilter: string;
  sfdxProject: string;
}

export class ApexDebug extends DebugSession {
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

  protected launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: LaunchRequestArguments
  ): void {
    this.sfdxProject = args.sfdxProject;
    this.mySessionService
      .forProject(args.sfdxProject)
      .withUserFilter(args.userIdFilter)
      .withEntryFilter(args.entryPointFilter)
      .withRequestFilter(args.requestTypeFilter)
      .start()
      .then(cmdResponse => {
        this.finalizeLaunch(response, cmdResponse);
      });
  }

  protected finalizeLaunch(
    response: DebugProtocol.LaunchResponse,
    cmdResponse: CommandOutput
  ): void {
    if (this.mySessionService.isConnected()) {
      response.success = true;
      this.logToDebugConsole(
        nls.localize('session_started_text', cmdResponse.getId())
      );
    } else {
      response.success = false;
      response.message = cmdResponse.getCmdMsg();
      this.suggestErrorAction(cmdResponse.getCmdAction());
    }
    this.sendResponse(response);
  }

  protected disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
    args: DebugProtocol.DisconnectArguments
  ): void {
    if (this.mySessionService.isConnected()) {
      this.mySessionService.stop().then(cmdResponse => {
        this.finalizeDisconnect(response, cmdResponse);
      });
    } else {
      response.success = true;
      this.sendResponse(response);
    }
  }

  protected finalizeDisconnect(
    response: DebugProtocol.DisconnectResponse,
    cmdResponse: CommandOutput
  ): void {
    if (!this.mySessionService.isConnected()) {
      response.success = true;
      this.logToDebugConsole(
        nls.localize('session_terminated_text', cmdResponse.getId())
      );
    } else {
      response.success = false;
      response.message = cmdResponse.getCmdMsg();
      this.suggestErrorAction(cmdResponse.getCmdAction());
    }
    this.sendResponse(response);
  }

  private logToDebugConsole(msg: string): void {
    if (msg && msg.length !== 0) {
      this.sendEvent(new OutputEvent(`${msg}\n\n`));
    }
  }

  private suggestErrorAction(msg: string): void {
    if (msg && msg.length !== 0) {
      this.sendEvent(
        new OutputEvent(
          `${nls.localize('try_this_text')}:\n${msg}\n\n`,
          'stderr'
        )
      );
    }
  }
}

DebugSession.run(ApexDebug);
