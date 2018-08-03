/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import vscode = require('vscode');
import TelemetryReporter from 'vscode-extension-telemetry';
import { TELEMETRY_OPT_OUT_LINK } from '../constants';
import { nls } from '../messages';
import { sfdxCoreSettings } from '../settings';

const TELEMETRY_GLOBAL_VALUE = 'sfdxTelemetryMessage';
const EXTENSION_NAME = 'salesforcedx-vscode-core';

export class TelemetryService {
  private static instance: TelemetryService;
  private context: vscode.ExtensionContext | undefined;
  private reporter: TelemetryReporter | undefined;

  public static getInstance() {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  public initializeService(context: vscode.ExtensionContext): void {
    this.context = context;

    // TelemetryReporter is not initialized if user has disabled telemetry setting.
    if (this.reporter === undefined && this.isTelemetryEnabled()) {
      const extensionPackage = require(this.context.asAbsolutePath(
        './package.json'
      ));

      this.reporter = new TelemetryReporter(
        'salesforcedx-vscode',
        extensionPackage.version,
        extensionPackage.aiKey
      );
      this.context.subscriptions.push(this.reporter);
    }
  }

  public getReporter(): TelemetryReporter | undefined {
    return this.reporter;
  }

  public isTelemetryEnabled(): boolean {
    return sfdxCoreSettings.getTelemetryEnabled();
  }

  private getHasTelemetryMessageBeenShown(): boolean {
    if (this.context === undefined) {
      return true;
    }

    const sfdxTelemetryState = this.context.globalState.get(
      TELEMETRY_GLOBAL_VALUE
    );

    return typeof sfdxTelemetryState === 'undefined';
  }

  private setTelemetryMessageShowed(): void {
    if (this.context === undefined) {
      return;
    }

    this.context.globalState.update(TELEMETRY_GLOBAL_VALUE, true);
  }

  public showTelemetryMessage() {
    // check if we've ever shown Telemetry message to user
    const showTelemetryMessage = this.getHasTelemetryMessageBeenShown();

    if (showTelemetryMessage) {
      // Show the message and set telemetry to true;
      const showButtonText = nls.localize('telemetry_legal_dialog_button_text');
      vscode.window
        .showInformationMessage(
          nls.localize('telemetry_legal_dialog_message'),
          showButtonText
        )
        .then(selection => {
          // Open disable telemetry link
          if (selection && selection === showButtonText) {
            vscode.commands.executeCommand(
              'vscode.open',
              vscode.Uri.parse(TELEMETRY_OPT_OUT_LINK)
            );
          }
        });
      this.setTelemetryMessageShowed();
    }
  }

  public sendExtensionActivationEvent(): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled()) {
      this.reporter.sendTelemetryEvent('activationEvent', {
        extensionName: EXTENSION_NAME
      });
    }
  }

  public sendExtensionDeactivationEvent(): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled()) {
      this.reporter.sendTelemetryEvent('deactivationEvent', {
        extensionName: EXTENSION_NAME
      });
    }
  }

  public sendCommandEvent(commandName: string): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled()) {
      this.reporter.sendTelemetryEvent('commandExecution', {
        extensionName: EXTENSION_NAME,
        commandName
      });
    }
  }

  public dispose(): void {
    if (this.reporter !== undefined) {
      this.reporter.dispose();
    }
  }
}
