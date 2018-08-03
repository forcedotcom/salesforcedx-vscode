/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import TelemetryReporter from 'vscode-extension-telemetry';

const EXTENSION_NAME = 'salesforcedx-vscode-lwc';

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
}
