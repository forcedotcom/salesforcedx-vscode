/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as util from 'util';
import { commands, ExtensionContext, Uri, window } from 'vscode';
import { TELEMETRY_OPT_OUT_LINK } from '../constants';
import { nls } from '../messages';
import { sfdxCoreSettings } from '../settings';
import { disableCLITelemetry, isCLITelemetryAllowed } from '../util';
import TelemetryReporter from './telemetryReporter';

const TELEMETRY_GLOBAL_VALUE = 'sfdxTelemetryMessage';
const EXTENSION_NAME = 'salesforcedx-vscode-core';

interface CommandMetric {
  extensionName: string;
  commandName: string;
  executionTime?: string;
}

export interface Measurements {
  [key: string]: number;
}

export interface Properties {
  [key: string]: string;
}

export interface TelemetryData {
  properties?: Properties;
  measurements?: Measurements;
}

export class TelemetryBuilder {
  private properties?: Properties;
  private measurements?: Measurements;

  public addProperty(key: string, value: string) {
    this.properties = this.properties || {};
    this.properties[key] = value;
  }

  public addMeasurement(key: string, value: number) {
    this.measurements = this.measurements || {};
    this.measurements[key] = value;
  }

  public build(): TelemetryData {
    return {
      properties: this.properties,
      measurements: this.measurements
    };
  }
}

export class TelemetryService {
  private static instance: TelemetryService;
  private context: ExtensionContext | undefined;
  private reporter: TelemetryReporter | undefined;
  private cliAllowsTelemetry: boolean = true;

  public static getInstance() {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  public async initializeService(
    context: ExtensionContext,
    machineId: string
  ): Promise<void> {
    this.context = context;
    this.cliAllowsTelemetry = await this.checkCliTelemetry();
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

    this.setCliTelemetryEnabled(this.isTelemetryEnabled());
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
      window
        .showInformationMessage(showMessage, showButtonText)
        .then(selection => {
          // Open disable telemetry link
          if (selection && selection === showButtonText) {
            commands.executeCommand(
              'vscode.open',
              Uri.parse(TELEMETRY_OPT_OUT_LINK)
            );
          }
        });
      this.setTelemetryMessageShowed();
    }
  }

  public sendExtensionActivationEvent(hrstart: [number, number]): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled) {
      const startupTime = this.getEndHRTime(hrstart);
      this.reporter.sendTelemetryEvent(
        'activationEvent',
        {
          extensionName: EXTENSION_NAME
        },
        { startupTime }
      );
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
    properties?: Properties,
    measurements?: Measurements
  ): void {
    if (
      this.reporter !== undefined &&
      this.isTelemetryEnabled() &&
      commandName
    ) {
      const baseProperties: CommandMetric = {
        extensionName: EXTENSION_NAME,
        commandName
      };
      const aggregatedProps = Object.assign(baseProperties, properties);

      let aggregatedMeasurements: Measurements | undefined;
      if (hrstart || measurements) {
        aggregatedMeasurements = Object.assign({}, measurements);
        if (hrstart) {
          aggregatedMeasurements.executionTime = this.getEndHRTime(hrstart);
        }
      }
      this.reporter.sendTelemetryEvent(
        'commandExecution',
        aggregatedProps,
        aggregatedMeasurements
      );
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

  public getEndHRTime(hrstart: [number, number]): number {
    const hrend = process.hrtime(hrstart);
    return Number(util.format('%d%d', hrend[0], hrend[1] / 1000000));
  }

  public async checkCliTelemetry(): Promise<boolean> {
    return await isCLITelemetryAllowed();
  }

  public setCliTelemetryEnabled(isEnabled: boolean) {
    if (!isEnabled) {
      disableCLITelemetry();
    }
  }
}
