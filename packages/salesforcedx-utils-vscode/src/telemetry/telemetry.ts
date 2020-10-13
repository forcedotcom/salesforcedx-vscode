/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as util from 'util';
import { ExtensionContext, workspace } from 'vscode';
import {
  disableCLITelemetry,
  isCLITelemetryAllowed
} from '../cli/cliConfiguration';
import TelemetryReporter from './telemetryReporter';

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
      const packageJson = require(path.join('..', '..', '..', 'package.json'));
      this.reporter = new TelemetryReporter(
        'salesforcedx-vscode',
        packageJson.version,
        packageJson.aiKey,
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
    return (
      workspace
        .getConfiguration('telemetry')
        .get<boolean>('enableTelemetry', true) &&
      workspace
        .getConfiguration('salesforcedx-vscode-core')
        .get<boolean>('telemetry.enabled', true) &&
      this.cliAllowsTelemetry
    );
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
