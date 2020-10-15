/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as util from 'util';
import * as vscode from 'vscode';
import { ExtensionContext, workspace } from 'vscode';
import {
  disableCLITelemetry,
  isCLITelemetryAllowed
} from '../cli/cliConfiguration';
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
    extensionName: string
  ): Promise<void> {
    this.context = context;
    this.extensionName = extensionName;

    this.checkCliTelemetry()
      .then(async cliEnabled => {
        this.setCliTelemetryEnabled(
          this.isTelemetryExtensionConfigurationEnabled() && cliEnabled
        );
      })
      .catch(error => {
        console.log('Error initializing telemetry service: ' + error);
      });

    const machineId =
      vscode && vscode.env ? vscode.env.machineId : 'someValue.machineId';
    const isDevMode = machineId === 'someValue.machineId';

    // TelemetryReporter is not initialized if user has disabled telemetry setting.
    if (
      this.reporter === undefined &&
      this.isTelemetryEnabled() &&
      !isDevMode
    ) {
      const packageJson = require(path.join('..', '..', '..', 'package.json'));
      this.reporter = new TelemetryReporter(
        'salesforcedx-vscode',
        packageJson.version,
        packageJson.aiKey,
        true
      );
      this.context.subscriptions.push(this.reporter);
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

  public isTelemetryExtensionConfigurationEnabled() {
    return (
      workspace
        .getConfiguration('telemetry')
        .get<boolean>('enableTelemetry', true) &&
      workspace
        .getConfiguration('salesforcedx-vscode-core')
        .get<boolean>('telemetry.enabled', true)
    );
  }

  public setCliTelemetryEnabled(isEnabled: boolean) {
    if (!isEnabled) {
      disableCLITelemetry();
    }
  }

  public async sendExtensionActivationEvent(hrstart: [number, number]) {
    if (this.reporter !== undefined && (await this.isTelemetryEnabled())) {
      const startupTime = this.getEndHRTime(hrstart);
      this.reporter.sendTelemetryEvent(
        'activationEvent',
        {
          extensionName: this.extensionName
        },
        { startupTime }
      );
    }
  }

  public async sendExtensionDeactivationEvent() {
    if (this.reporter !== undefined && (await this.isTelemetryEnabled())) {
      this.reporter.sendTelemetryEvent('deactivationEvent', {
        extensionName: this.extensionName
      });
    }
  }

  public async sendCommandEvent(
    commandName?: string,
    hrstart?: [number, number],
    properties?: Properties,
    measurements?: Measurements
  ) {
    if (
      this.reporter !== undefined &&
      (await this.isTelemetryEnabled()) &&
      commandName
    ) {
      const baseProperties: CommandMetric = {
        extensionName: this.extensionName,
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

  public async sendException(name: string, message: string) {
    if (this.reporter !== undefined && (await this.isTelemetryEnabled())) {
      this.reporter.sendExceptionEvent(name, message);
    }
  }

  public async sendEventData(
    eventName: string,
    properties?: { [key: string]: string },
    measures?: { [key: string]: number }
  ) {
    if (this.reporter !== undefined && (await this.isTelemetryEnabled())) {
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
}
