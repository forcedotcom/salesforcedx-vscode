/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Properties,
  Measurements,
  TelemetryData,
  TelemetryServiceInterface,
  TelemetryReporter,
  ActivationInfo
} from '@salesforce/vscode-service-provider';
import * as util from 'util';
import { ExtensionContext, ExtensionMode, workspace, extensions } from 'vscode';
import {
  DEFAULT_AIKEY,
  SFDX_CORE_CONFIGURATION_NAME,
  SFDX_CORE_EXTENSION_NAME,
  SFDX_EXTENSION_PACK_NAME
} from '../constants';
import * as Settings from '../settings';
import {
  disableCLITelemetry,
  isCLITelemetryAllowed
} from '../telemetry/cliConfiguration';
import { AppInsights } from '../telemetry/reporters/appInsights';
import { LogStream } from '../telemetry/reporters/logStream';
import { LogStreamConfig } from '../telemetry/reporters/logStreamConfig';
import { TelemetryFile } from '../telemetry/reporters/telemetryFile';
import { UserService } from './userService';

type CommandMetric = {
  extensionName: string;
  commandName: string;
  executionTime?: string;
};

export class TelemetryBuilder {
  private properties?: Properties;
  private measurements?: Measurements;

  public addProperty(key: string, value?: string): TelemetryBuilder {
    this.properties = this.properties || {};
    if (value !== undefined) {
      this.properties[key] = value;
    }
    return this;
  }

  public addMeasurement(key: string, value?: number): TelemetryBuilder {
    this.measurements = this.measurements || {};
    if (value !== undefined) {
      this.measurements[key] = value;
    }
    return this;
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
  public static getInstance(extensionName?: string): TelemetryServiceInterface {
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

export class TelemetryService implements TelemetryServiceInterface {
  private extensionContext: ExtensionContext | undefined;
  private reporters: TelemetryReporter[] = [];
  private aiKey = DEFAULT_AIKEY;
  private version: string = '';
  /**
   * Retrieve Telemetry Service according to the extension name.
   * If no extension name provided, return the instance for core extension by default
   * @param extensionName extension name
   */
  public static getInstance(extensionName?: string): TelemetryServiceInterface {
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
  public initializeService(
    extensionContext: ExtensionContext
  ): Promise<void> {
    const { name, version, aiKey } = extensionContext.extension.packageJSON as { name: string; version: string; aiKey: string };
    return this.initializeServiceWithAttributes(name, aiKey, version, extensionContext.extensionMode);
  }

  public async initializeServiceWithAttributes(name: string, aiKey?: string, version?: string, extensionMode?: ExtensionMode): Promise<void> {
    if (!name) {
      console.log('Extension name is not defined in package.json');
    }
    if (!version) {
      console.log('Extension version is not defined in package.json');
    }
    this.extensionContext = getExtensionContextByName(name);
    this.extensionName = name;
    this.version = version ?? '';
    this.aiKey = aiKey || this.aiKey;

    this.checkCliTelemetry()
      .then(cliEnabled => {
        this.setCliTelemetryEnabled(
          this.isTelemetryExtensionConfigurationEnabled() && cliEnabled
        );
      })
      .catch(error => {
        console.log('Error initializing telemetry service: ' + error);
      });

    const isDevMode =
      extensionMode !== ExtensionMode.Production;

    // TelemetryReporter is not initialized if user has disabled telemetry setting.
    if (this.reporters.length === 0 && (await this.isTelemetryEnabled())) {
      if (!isDevMode) {
        console.log('adding AppInsights reporter.');
        const userId = this.extensionContext ? await UserService.getTelemetryUserId(this.extensionContext) : 'unknown';
        this.reporters.push(
          new AppInsights(
            this.getTelemetryReporterName(),
            this.version,
            this.aiKey,
            userId,
            true
          )
        );

        // Assuming this fs streaming is more efficient than the appendFile technique that
        // the new TelemetryFile reporter uses, I am keeping the logic in place for which
        // reporter is used when.  The original log stream functionality only worked under
        // the same conditions as the AppInsights capabilities, but with additional configuration.
        if (LogStreamConfig.isEnabledFor(this.extensionName)) {
          this.reporters.push(
            new LogStream(
              this.getTelemetryReporterName(),
              LogStreamConfig.logFilePath()
            )
          );
        }
      } else {
        // Dev Mode
        //
        // The new TelemetryFile reporter is run in Dev mode, and only
        // requires the advanced setting to be set re: configuration.
        if (
          Settings.SettingsService.isAdvancedSettingEnabledFor(
            this.extensionName,
            Settings.AdvancedSettings.LOCAL_TELEMETRY_LOGGING
          )
        ) {
          this.reporters.push(new TelemetryFile(this.extensionName));
        }
      }
    }

    this.extensionContext?.subscriptions.push(...this.reporters);
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

  public getReporters(): TelemetryReporter[] {
    return this.reporters;
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

  public sendActivationEventInfo(activationInfo: ActivationInfo) {
    const telemetryBuilder = new TelemetryBuilder();
    const telemetryData = telemetryBuilder
      .addProperty(
        'activateStartDate',
        activationInfo.activateStartDate?.toISOString()
      )
      .addProperty(
        'activateEndDate',
        activationInfo.activateEndDate?.toISOString()
      )
      .addProperty('loadStartDate', activationInfo.loadStartDate?.toISOString())
      .addMeasurement(
        'extensionActivationTime',
        activationInfo.extensionActivationTime
      )
      .build();
    this.sendExtensionActivationEvent(
      activationInfo.startActivateHrTime,
      activationInfo.markEndTime,
      telemetryData
    );
  }

  public sendExtensionActivationEvent(
    hrstart: [number, number],
    markEndTime?: number,
    telemetryData?: TelemetryData
  ): void {
    const startupTime = markEndTime ?? this.getEndHRTime(hrstart);
    const properties = {
      extensionName: this.extensionName,
      ...(telemetryData?.properties ? telemetryData.properties : {})
    };
    const measurements = {
      startupTime,
      ...(telemetryData?.measurements ? telemetryData.measurements : {})
    };

    this.validateTelemetry(() => {
      this.reporters.forEach(reporter => {
        reporter.sendTelemetryEvent(
          'activationEvent',
          properties,
          measurements
        );
      });
    });
  }

  public sendExtensionDeactivationEvent(): void {
    this.validateTelemetry(() => {
      this.reporters.forEach(reporter => {
        reporter.sendTelemetryEvent('deactivationEvent', {
          extensionName: this.extensionName
        });
      });
    });
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
        this.reporters.forEach(reporter => {
          reporter.sendTelemetryEvent(
            'commandExecution',
            aggregatedProps,
            aggregatedMeasurements
          );
        });
      }
    });
  }

  public sendException(name: string, message: string) {
    this.validateTelemetry(() => {
      this.reporters.forEach(reporter => {
        try {
          reporter.sendExceptionEvent(name, message);
        } catch (error) {
          console.log(
            'There was an error sending an exception report to: ' +
            typeof reporter +
            ' ' +
            'name: ' +
            name +
            ' message: ' +
            message
          );
        }
      });
    });
  }

  public sendEventData(
    eventName: string,
    properties?: { [key: string]: string },
    measures?: { [key: string]: number }
  ): void {
    this.validateTelemetry(() => {
      this.reporters.forEach(reporter => {
        reporter.sendTelemetryEvent(eventName, properties, measures);
      });
    });
  }

  public dispose(): void {
    this.reporters.forEach(reporter => {
      reporter.dispose().catch(err => console.log(err));
    });
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
    if (this.reporters.length > 0) {
      this.isTelemetryEnabled()
        .then(enabled => (enabled ? callback() : undefined))
        .catch(err => console.error(err));
    }
  }
}

const getExtensionContextByName = (extensionName: string): ExtensionContext | undefined => {
  const extension = extensions.getExtension(extensionName);
  if (extension) {
    // Access the extension's context
    return extension.exports as ExtensionContext;
  }
};
