/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { appendFileSync } from 'fs';
import * as util from 'util';
import { ExtensionContext, ExtensionMode, workspace } from 'vscode';
import {
  DEFAULT_AIKEY,
  SFDX_CORE_CONFIGURATION_NAME,
  SFDX_CORE_EXTENSION_NAME,
  SFDX_EXTENSION_PACK_NAME
} from '../constants';
import { SfdxSettingsService } from '../settings';
import { disableCLITelemetry, isCLITelemetryAllowed } from './cliConfiguration';
import { TelemetryReporter } from './telemetryReporter';

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

// export only for unit test
export class TelemetryServiceProvider {
  public static instances = new Map<string, TelemetryService>(); // public only for unit test
  public static getInstance(extensionName?: string): TelemetryService {
    // default if not present
    const name = extensionName || SFDX_CORE_EXTENSION_NAME;
    let service = TelemetryServiceProvider.instances.get(name);
    if (!service) {
      service = new TelemetryService();
      TelemetryServiceProvider.instances.set(name, service);
    }
    return service;

  }
}

export class TelemetryService {
  private extensionContext: ExtensionContext | undefined;
  private reporter: TelemetryReporter | undefined;
  private aiKey = DEFAULT_AIKEY;
  private version: string = '';
  /**
   * Retrieve Telemetry Service according to the extension name.
   * If no extension name provided, return the instance for core extension by default
   * @param extensionName extension name
   */
  public static getInstance(extensionName?: string) {
    return TelemetryServiceProvider.getInstance(extensionName);
  }
  /**
   * Cached promise to check if CLI telemetry config is enabled
   */
  private cliAllowsTelemetryPromise?: Promise<boolean> = undefined;
  public extensionName: string = 'unknown';

  /**
   * Initialize Telemetry Service during extension activation.
   * @param extensionContext extension context
   * @param extensionName extension name
   */
  public async initializeService(
    extensionContext: ExtensionContext
  ): Promise<void> {
    const { name, version, aiKey } = extensionContext.extension.packageJSON;
    if (!name) {
      console.log('Extension name is not defined in package.json');
    }
    if (!version) {
      console.log('Extension version is not defined in package.json');
    }
    this.extensionContext = extensionContext;
    this.extensionName = name;
    this.version = version;
    this.aiKey = aiKey || this.aiKey;

    this.checkCliTelemetry()
      .then(async cliEnabled => {
        this.setCliTelemetryEnabled(
          this.isTelemetryExtensionConfigurationEnabled() && cliEnabled
        );
      })
      .catch(error => {
        console.log('Error initializing telemetry service: ' + error);
      });

    const isDevMode =
      extensionContext.extensionMode !== ExtensionMode.Production;

    // TelemetryReporter is not initialized if user has disabled telemetry setting.
    if (
      this.reporter === undefined &&
      (await this.isTelemetryEnabled()) &&
      !isDevMode
    ) {
      this.reporter = new TelemetryReporter(
        this.getTelemetryReporterName(),
        this.version,
        this.aiKey,
        true
      );
      this.extensionContext.subscriptions.push(this.reporter);
    }
  }

  /**
   * Helper to get the name for telemetryReporter
   * if the extension from extension pack, use salesforcedx-vscode
   * otherwise use the extension name
   * exported only for unit test
   */
  public getTelemetryReporterName(): string {
    return this.extensionName.startsWith(SFDX_EXTENSION_PACK_NAME)
      ? SFDX_EXTENSION_PACK_NAME
      : this.extensionName;
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
        .getConfiguration(SFDX_CORE_CONFIGURATION_NAME)
        .get<boolean>('telemetry.enabled', true)
    );
  }

  public setCliTelemetryEnabled(isEnabled: boolean): void {
    if (!isEnabled) {
      disableCLITelemetry();
    }
  }

  public sendExtensionActivationEvent(hrstart: [number, number]): void {
    const startupTime = this.getEndHRTime(hrstart);
    this.validateTelemetry(() => {
      this.reporter!.sendTelemetryEvent(
        'activationEvent',
        {
          extensionName: this.extensionName
        },
        { startupTime }
      );
    });
    LocalTelemetryFile.maybeWrite('activationEvent', { extensionName: this.extensionName, startupTime });
  }

  public sendExtensionDeactivationEvent(): void {
    this.validateTelemetry(() => {
      this.reporter!.sendTelemetryEvent('deactivationEvent', {
        extensionName: this.extensionName
      });
    });
    LocalTelemetryFile.maybeWrite('deactivationEvent', { extensionName: this.extensionName });
  }

  public sendCommandEvent(
    commandName?: string,
    hrstart?: [number, number],
    properties?: Properties,
    measurements?: Measurements
  ): void {
    this.validateTelemetry(() => {
      if (commandName) {
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
        this.reporter!.sendTelemetryEvent(
          'commandExecution',
          aggregatedProps,
          aggregatedMeasurements
        );
      }
    });
    LocalTelemetryFile.maybeWrite(commandName || '', { ...properties, ...measurements });
  }

  public sendException(name: string, message: string) {
    this.validateTelemetry(() => {
      this.reporter!.sendExceptionEvent(name, message);
    });
    LocalTelemetryFile.maybeWrite(name || '', { message });
  }

  public sendEventData(
    eventName: string,
    properties?: { [key: string]: string },
    measures?: { [key: string]: number }
  ): void {
    this.validateTelemetry(() => {
      this.reporter!.sendTelemetryEvent(eventName, properties, measures);
    });
    LocalTelemetryFile.maybeWrite(eventName || '', { ...properties, ...measures });
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

  public hrTimeToMilliseconds(hrtime: [number, number]): number {
    return hrtime[0] * 1000 + hrtime[1] / 1000000;
  }

  /**
   * Helper to run a callback if telemetry has been initialized and is
   * enabled.
   *
   * @param callback function to call if telemetry is enabled
   */
  private validateTelemetry(callback: () => void): void {
    if (this.reporter !== undefined) {
      this.isTelemetryEnabled()
        .then(enabled => (enabled ? callback() : undefined))
        .catch(err => console.error(err));
    }
  }
}

export class LocalTelemetryFile {
  public static maybeWrite(command: string, data: {
    [key: string]: string | number;
  }) {
    if (startedInDebugMode() && SfdxSettingsService.isLocalTelemetryLoggingEnabled()) {
      const timestamp = new Date().toISOString();
      appendFileSync('telemetry.json', JSON.stringify({ timestamp, command, data }, null, 2));
    }
  }
}

// tmp: copied from vscode-extensions (could be imported via api)
function startedInDebugMode(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const args = (process as any).execArgv;
  if (args) {
    return args.some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (arg: any) =>
        /^--debug=?/.test(arg) || /^--debug-brk=?/.test(arg) || /^--inspect=?/.test(arg) || /^--inspect-brk=?/.test(arg)
    );
  }
  return false;
}

