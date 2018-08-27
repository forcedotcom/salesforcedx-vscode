/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import TelemetryReporter from 'vscode-extension-telemetry';

const EXTENSION_NAME = 'salesforcedx-vscode-apex-replay-debugger';

export class TelemetryService {
  private static instance: TelemetryService;
  private reporter: TelemetryReporter | undefined;
  private isTelemetryEnabled: boolean;

  constructor() {
    this.isTelemetryEnabled = false;
  }

  public static getInstance() {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  public initializeService(
    reporter: TelemetryReporter,
    isTelemetryEnabled: boolean
  ): void {
    this.isTelemetryEnabled = isTelemetryEnabled;
    this.reporter = reporter;
  }

  public sendExtensionActivationEvent(): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled) {
      this.reporter.sendTelemetryEvent('activationEvent', {
        extensionName: EXTENSION_NAME
      });
    }
  }

  public sendExtensionDeactivationEvent(): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled) {
      this.reporter.sendTelemetryEvent('deactivationEvent', {
        extensionName: EXTENSION_NAME
      });
    }
  }

  public sendCommandEvent(commandName: string): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled) {
      this.reporter.sendTelemetryEvent('commandExecution', {
        extensionName: EXTENSION_NAME,
        commandName
      });
    }
  }

  public sendLaunchEvent(logSizeStr: string, errorMsg: string): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled) {
      this.reporter.sendTelemetryEvent('launchDebuggerSession', {
        extensionName: EXTENSION_NAME,
        logSize: logSizeStr,
        errorMessage: errorMsg
      });
    }
  }

  public sendCheckpointEvent(errorMsg: string): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled) {
      this.reporter.sendTelemetryEvent('updateCheckpoints', {
        extensionName: EXTENSION_NAME,
        errorMessage: errorMsg
      });
    }
  }

  public sendErrorEvent(errorMsg: string, callstack: string): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled) {
      this.reporter.sendTelemetryEvent('error', {
        extensionName: EXTENSION_NAME,
        errorMessage: errorMsg,
        errorStack: callstack
      });
    }
  }
}
