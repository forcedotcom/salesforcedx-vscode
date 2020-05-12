/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as util from 'util';
import { TELEMETRY_OPT_OUT_LINK } from '../constants';
import { nls } from '../messages';
import { sfdxCoreSettings } from '../settings';
import { disableCLITelemetry } from '../util';
import TelemetryReporter from './telemetryReporter';
import vscode = require('vscode');

const TELEMETRY_GLOBAL_VALUE = 'sfdxTelemetryMessage';
const EXTENSION_NAME = 'salesforcedx-vscode-core';

interface CommandMetric {
  extensionName: string;
  commandName: string;
  executionTime?: string;
}

export interface TelemetryData {
  properties?: { [key: string]: string };
  measurements?: { [key: string]: number };
}

export class TelemetryService {
  private static instance: TelemetryService;
  private context: vscode.ExtensionContext | undefined;
  private reporter: TelemetryReporter | undefined;
  private cliAllowsTelemetry: boolean = true;

  public static getInstance() {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  public initializeService(
    context: vscode.ExtensionContext,
    machineId: string,
    cliAllowsTelemetry: boolean = true
  ): void {
    this.context = context;
    this.cliAllowsTelemetry = cliAllowsTelemetry;
    const isDevMode = machineId === 'someValue.machineId';
    // TelemetryReporter is not initialized if user has disabled telemetry setting.
    if (
      this.reporter === undefined &&
      this.isTelemetryEnabled() &&
      !isDevMode
    ) {
      const extensionPackage = require(this.context.asAbsolutePath(
        './package.json'
      ));

      this.reporter = new TelemetryReporter(
        'salesforcedx-vscode',
        extensionPackage.version,
        extensionPackage.aiKey,
        true
      );
      this.context.subscriptions.push(this.reporter);
    }

    this.setCliTelemetryEnabled(this.isTelemetryEnabled() && !isDevMode);
  }

  public getReporter(): TelemetryReporter | undefined {
    return this.reporter;
  }

  public isTelemetryEnabled(): boolean {
    return sfdxCoreSettings.getTelemetryEnabled() && this.cliAllowsTelemetry;
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
      const showMessage = nls.localize(
        'telemetry_legal_dialog_message',
        TELEMETRY_OPT_OUT_LINK
      );
      vscode.window
        .showInformationMessage(showMessage, showButtonText)
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

  public sendExtensionActivationEvent(hrstart: [number, number]): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled) {
      const startupTime = this.getEndHRTime(hrstart);
      this.reporter.sendTelemetryEvent('activationEvent', {
        extensionName: EXTENSION_NAME,
        startupTime
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

  public sendCommandEvent(
    commandName?: string,
    hrstart?: [number, number],
    additionalData?: any
  ): void {
    if (
      this.reporter !== undefined &&
      this.isTelemetryEnabled() &&
      commandName
    ) {
      const baseTelemetry: CommandMetric = {
        extensionName: EXTENSION_NAME,
        commandName
      };

      if (hrstart) {
        baseTelemetry['executionTime'] = this.getEndHRTime(hrstart);
      }

      const aggregatedTelemetry = Object.assign(baseTelemetry, additionalData);
      this.reporter.sendTelemetryEvent('commandExecution', aggregatedTelemetry);
    }
  }

  public sendException(name: string, message: string): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled) {
      this.reporter.sendExceptionEvent(name, message);
    }
  }

  public sendEventData(
    eventName: string,
    properties?: { [key: string]: string },
    measures?: { [key: string]: number }
  ): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled) {
      this.reporter.sendTelemetryEvent(eventName, properties, measures);
    }
  }

  public dispose(): void {
    if (this.reporter !== undefined) {
      this.reporter.dispose().catch(err => console.log(err));
    }
  }

  public getEndHRTime(hrstart: [number, number]): string {
    const hrend = process.hrtime(hrstart);
    return util.format('%d%d', hrend[0], hrend[1] / 1000000);
  }

  public setCliTelemetryEnabled(isEnabled: boolean) {
    if (!isEnabled) {
      disableCLITelemetry();
    }
  }
}
