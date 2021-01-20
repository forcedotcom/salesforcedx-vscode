/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as util from 'util';
import {
  commands,
  env,
  ExtensionContext,
  Uri,
  window,
  workspace
} from 'vscode';
import { nls } from '../messages';
import {
  TELEMETRY_GLOBAL_VALUE,
  TELEMETRY_OPT_OUT_LINK
} from '../types/constants';
import { disableCLITelemetry, isCLITelemetryAllowed } from './cliConfiguration';
import TelemetryReporter from './telemetryReporter';

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
  private aiKey: string = '';
  private version: string = '';
  /**
   * Cached promise to check if CLI telemetry config is enabled
   */
  private cliAllowsTelemetryPromise?: Promise<boolean> = undefined;
  public extensionName: string = 'unknown';

  public static getInstance() {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  /**
   * Initialize Telemetry Service during extension activation.
   * @param context extension context
   * @param extensionName extension name
   */
  public async initializeService(
    context: ExtensionContext,
    extensionName: string,
    aiKey: string,
    version: string
  ): Promise<void> {
    this.context = context;
    this.extensionName = extensionName;
    this.aiKey = aiKey;
    this.version = version;

    this.checkCliTelemetry()
      .then(async cliEnabled => {
        this.setCliTelemetryEnabled(
          this.isTelemetryExtensionConfigurationEnabled() && cliEnabled
        );
      })
      .catch(error => {
        console.log('Error initializing telemetry service: ' + error);
      });

    const machineId = env ? env.machineId : 'someValue.machineId';
    const isDevMode = machineId === 'someValue.machineId';

    // TelemetryReporter is not initialized if user has disabled telemetry setting.
    if (
      this.reporter === undefined &&
      this.isTelemetryEnabled() &&
      !isDevMode
    ) {
      this.reporter = new TelemetryReporter(
        'salesforcedx-vscode',
        this.version,
        this.aiKey,
        true
      );
      this.context.subscriptions.push(this.reporter);
    }
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

  public getReporter(): TelemetryReporter | undefined {
    return this.reporter;
  }

  public async isTelemetryEnabled(): Promise<boolean> {
    return (
      this.isTelemetryExtensionConfigurationEnabled() &&
      (await this.checkCliTelemetry())
    );
  }

  public async checkCliTelemetry(): Promise<boolean> {
    if (typeof this.cliAllowsTelemetryPromise !== 'undefined') {
      return this.cliAllowsTelemetryPromise;
    }
    this.cliAllowsTelemetryPromise = isCLITelemetryAllowed();
    return await this.cliAllowsTelemetryPromise;
  }

  public isTelemetryExtensionConfigurationEnabled(): boolean {
    return (
      workspace
        .getConfiguration('telemetry')
        .get<boolean>('enableTelemetry', true) &&
      workspace
        .getConfiguration('salesforcedx-vscode-core')
        .get<boolean>('telemetry.enabled', true)
    );
  }

  public setCliTelemetryEnabled(isEnabled: boolean): void {
    if (!isEnabled) {
      disableCLITelemetry();
    }
  }

  public sendExtensionActivationEvent(hrstart: [number, number]): void {
    if (this.reporter !== undefined) {
      this.isTelemetryEnabled()
        .then(telemetryEnabled => {
          if (telemetryEnabled) {
            const startupTime = this.getEndHRTime(hrstart);
            this.reporter!.sendTelemetryEvent(
              'activationEvent',
              {
                extensionName: this.extensionName
              },
              { startupTime }
            );
          }
        })
        .catch(err => console.error(err));
    }
  }

  public sendExtensionDeactivationEvent(): void {
    if (this.reporter !== undefined) {
      this.isTelemetryEnabled()
        .then(telemetryEnabled => {
          if (telemetryEnabled) {
            this.reporter!.sendTelemetryEvent('deactivationEvent', {
              extensionName: this.extensionName
            });
          }
        })
        .catch(err => console.error(err));
    }
  }

  public sendCommandEvent(
    commandName?: string,
    hrstart?: [number, number],
    properties?: Properties,
    measurements?: Measurements
  ): void {
    if (this.reporter !== undefined && commandName) {
      this.isTelemetryEnabled()
        .then(telemetryEnabled => {
          if (telemetryEnabled) {
            const baseProperties: CommandMetric = {
              extensionName: this.extensionName,
              commandName
            };
            const aggregatedProps = Object.assign(baseProperties, properties);

            let aggregatedMeasurements: Measurements | undefined;
            if (hrstart || measurements) {
              aggregatedMeasurements = Object.assign({}, measurements);
              if (hrstart) {
                aggregatedMeasurements.executionTime = this.getEndHRTime(
                  hrstart
                );
              }
            }
            this.reporter!.sendTelemetryEvent(
              'commandExecution',
              aggregatedProps,
              aggregatedMeasurements
            );
          }
        })
        .catch(err => console.error(err));
    }
  }

  public sendException(name: string, message: string) {
    if (this.reporter !== undefined) {
      this.isTelemetryEnabled()
        .then(telemetryEnabled => {
          if (telemetryEnabled) {
            this.reporter!.sendExceptionEvent(name, message);
          }
        })
        .catch(err => console.error(err));
    }
  }

  public sendEventData(
    eventName: string,
    properties?: { [key: string]: string },
    measures?: { [key: string]: number }
  ): void {
    if (this.reporter !== undefined) {
      this.isTelemetryEnabled()
        .then(telemetryEnabled => {
          if (telemetryEnabled) {
            this.reporter!.sendTelemetryEvent(eventName, properties, measures);
          }
        })
        .catch(err => console.error(err));
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
}
