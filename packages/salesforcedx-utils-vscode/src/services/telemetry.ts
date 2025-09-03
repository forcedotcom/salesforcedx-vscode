/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Properties,
  Measurements,
  TelemetryData,
  TelemetryReporter,
  TelemetryServiceInterface,
  ActivationInfo
} from '@salesforce/vscode-service-provider';
import { ExtensionContext, ExtensionMode, workspace } from 'vscode';
import { z } from 'zod';
import {
  DEFAULT_AIKEY,
  SFDX_CORE_CONFIGURATION_NAME,
  SFDX_CORE_EXTENSION_NAME,
  SFDX_EXTENSION_PACK_NAME
} from '../constants';
import { TimingUtils } from '../helpers/timingUtils';
import { disableCLITelemetry, isCLITelemetryAllowed } from '../telemetry/cliConfiguration';
import { determineReporters, initializeO11yReporter } from '../telemetry/reporters/determineReporters';
import { TelemetryReporterConfig } from '../telemetry/reporters/telemetryReporterConfig';
import { isInternalHost } from '../telemetry/utils/isInternal';
import { UserService, getWebTelemetryUserId, DefaultSharedTelemetryProvider } from './userService';

type CommandMetric = {
  extensionName: string;
  commandName: string;
  executionTime?: string;
};

export class TelemetryBuilder {
  private properties?: Properties;
  private measurements?: Measurements;

  public addProperty(key: string, value?: string): TelemetryBuilder {
    if (value !== undefined) {
      this.properties = { ...this.properties, [key]: value };
    }
    return this;
  }

  public addMeasurement(key: string, value?: number): TelemetryBuilder {
    if (value !== undefined) {
      this.measurements = { ...this.measurements, [key]: value };
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
    const name = extensionName ?? SFDX_CORE_EXTENSION_NAME;
    if (!extensionName) {
      console.log(`[TelemetryServiceProvider] No extensionName provided. Defaulting to "${SFDX_CORE_EXTENSION_NAME}".`);
    }
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
  public isInternal: boolean = false;
  public isDevMode: boolean = false;

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
   * Convert timing parameter to number for backwards compatibility
   * @param timing Either a number (milliseconds) or hrtime tuple [seconds, nanoseconds]
   * @returns number in milliseconds, or undefined if input is undefined
   */
  public hrTimeToMilliseconds(hrTime?: number | [number, number]): number {
    if (!hrTime) {
      return 0;
    } else if (typeof hrTime === 'number') {
      return hrTime;
    } else {
      // Convert hrtime [seconds, nanoseconds] to milliseconds since epoch
      const [seconds, nanoseconds] = hrTime;
      return seconds * 1000 + nanoseconds / 1000000;
    }
  }

  public getEndHRTime(hrstart: [number, number]): number {
    const endTime = performance.now();
    const startTimeMs = this.hrTimeToMilliseconds(hrstart);
    return startTimeMs ? endTime - startTimeMs : -1;
  }

  /**
   * Determines the appropriate SharedTelemetryProvider based on extension context.
   * Core extension uses undefined to avoid infinite loops, others use DefaultSharedTelemetryProvider.
   */
  private getSharedTelemetryProvider(extensionContext: ExtensionContext): DefaultSharedTelemetryProvider | undefined {
    return extensionContext.extension.id !== 'salesforce.salesforcedx-vscode-core'
      ? new DefaultSharedTelemetryProvider()
      : undefined;
  }

  /**
   * Initialize Telemetry Service during extension activation.
   * @param extensionContext extension context
   */
  public async initializeService(extensionContext: ExtensionContext): Promise<void> {
    const { name, version, aiKey, o11yUploadEndpoint, enableO11y } = extensionPackageJsonSchema.parse(
      extensionContext.extension.packageJSON
    );
    this.extensionContext = extensionContext;
    this.extensionName = name;
    this.version = version;
    this.aiKey ??= aiKey ?? DEFAULT_AIKEY;
    this.isInternal = isInternalHost();
    this.isDevMode = extensionContext.extensionMode !== ExtensionMode.Production;

    this.checkCliTelemetry()
      .then(cliEnabled => {
        this.setCliTelemetryEnabled(this.isTelemetryExtensionConfigurationEnabled() && cliEnabled);
      })
      .catch(error => {
        console.log(`Error initializing telemetry service: ${error}`);
      });

    if (this.reporters.length === 0 && (await this.isTelemetryEnabled())) {
      const userId = this.extensionContext ? await UserService.getTelemetryUserId(this.extensionContext) : 'unknown';
      const webUserId = this.extensionContext
        ? await getWebTelemetryUserId(this.getSharedTelemetryProvider(this.extensionContext))
        : 'unknown';
      const reporterConfig: TelemetryReporterConfig = {
        extName: this.extensionName,
        version: this.version,
        aiKey: this.aiKey,
        userId,
        reporterName: this.getTelemetryReporterName(),
        isDevMode: this.isDevMode,
        webUserId
      };

      const isO11yEnabled = typeof enableO11y === 'boolean' ? enableO11y : enableO11y?.toLowerCase() === 'true';

      if (isO11yEnabled) {
        if (!o11yUploadEndpoint) {
          console.log('o11yUploadEndpoint is not defined. Skipping O11y initialization.');
          return;
        }

        await initializeO11yReporter(reporterConfig.extName, o11yUploadEndpoint, userId, version, webUserId);
      }

      const reporters = determineReporters(reporterConfig);
      this.reporters.push(...reporters);
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
    return this.extensionName.startsWith(SFDX_EXTENSION_PACK_NAME) ? SFDX_EXTENSION_PACK_NAME : this.extensionName;
  }

  public getReporters(): TelemetryReporter[] {
    return this.reporters;
  }

  /**
   * Refreshes telemetry reporters with the latest user ID and webUserId field when org authorization changes.
   * This ensures that telemetry events use the correct webUserId field (hashed orgId + userId)
   * while maintaining the original user ID calculation.
   */
  public async refreshReporters(extensionContext: ExtensionContext): Promise<void> {
    if (!this.extensionContext || this.reporters.length === 0 || !(await this.isTelemetryEnabled())) {
      return;
    }

    // Get the updated user ID (original) and webUserId field
    const userId = await UserService.getTelemetryUserId(extensionContext);
    const webUserId = await getWebTelemetryUserId(this.getSharedTelemetryProvider(extensionContext));

    // Dispose existing reporters
    for (const reporter of this.reporters) {
      await reporter.dispose().catch(() => {});
    }
    this.reporters.length = 0;

    // Create new reporters with updated user ID and webUserId field
    const { name, version, o11yUploadEndpoint, enableO11y } = extensionPackageJsonSchema.parse(
      extensionContext.extension.packageJSON
    );

    const reporterConfig: TelemetryReporterConfig = {
      extName: name,
      version,
      aiKey: this.aiKey,
      userId,
      reporterName: this.getTelemetryReporterName(),
      isDevMode: this.isDevMode,
      webUserId
    };

    const isO11yEnabled = typeof enableO11y === 'boolean' ? enableO11y : enableO11y?.toLowerCase() === 'true';

    if (isO11yEnabled && o11yUploadEndpoint) {
      await initializeO11yReporter(reporterConfig.extName, o11yUploadEndpoint, userId, version, webUserId);
    }

    const reporters = determineReporters(reporterConfig);
    this.reporters.push(...reporters);
    this.extensionContext?.subscriptions.push(...this.reporters);

    console.log(`Telemetry reporters refreshed for ${name} with user ID: ${userId} and webUserId field: ${webUserId}`);
  }

  public async isTelemetryEnabled(): Promise<boolean> {
    return this.isInternal ? true : this.isTelemetryExtensionConfigurationEnabled() && (await this.checkCliTelemetry());
  }

  public async checkCliTelemetry(): Promise<boolean> {
    if (this.cliAllowsTelemetryPromise !== undefined) {
      return this.cliAllowsTelemetryPromise;
    }
    this.cliAllowsTelemetryPromise = isCLITelemetryAllowed();
    return await this.cliAllowsTelemetryPromise;
  }

  public isTelemetryExtensionConfigurationEnabled(): boolean {
    return (
      workspace.getConfiguration('telemetry').get<string>('telemetryLevel', 'all') !== 'off' &&
      workspace.getConfiguration(SFDX_CORE_CONFIGURATION_NAME).get<boolean>('telemetry.enabled', true)
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
      .addProperty('activateStartDate', activationInfo.activateStartDate?.toISOString())
      .addProperty('activateEndDate', activationInfo.activateEndDate?.toISOString())
      .addProperty('loadStartDate', activationInfo.loadStartDate?.toISOString())
      .addMeasurement('extensionActivationTime', activationInfo.extensionActivationTime)
      .build();
    this.sendExtensionActivationEvent(activationInfo.startActivateHrTime, activationInfo.markEndTime, telemetryData);
  }

  public sendExtensionActivationEvent(
    startTime?: number | [number, number],
    markEndTime?: number,
    telemetryData?: TelemetryData
  ): void {
    // Calculate startup time:
    // - Convert timing to number for backwards compatibility (supports both number and hrtime)
    // - If startTime is provided and > 0, use it as the start time
    // - If markEndTime is provided, use it as the end time, otherwise calculate elapsed time from startTime
    // - If neither startTime nor markEndTime are provided, this indicates a timing error - use a fallback
    let startupTime: number;

    const convertedStartTime = this.hrTimeToMilliseconds(startTime);

    if (convertedStartTime && convertedStartTime > 0) {
      // Valid start time provided - calculate elapsed time
      startupTime = markEndTime ?? TimingUtils.getElapsedTime(convertedStartTime);
    } else if (markEndTime) {
      // Only end time provided - use it directly
      startupTime = markEndTime;
    } else {
      // No valid timing provided - indicate this is an error case
      startupTime = 0;
      console.warn(`Extension ${this.extensionName}: No valid timing data provided for activation event`);
    }

    const properties = {
      extensionName: this.extensionName,
      ...telemetryData?.properties
    };
    const measurements = {
      startupTime,
      ...telemetryData?.measurements
    };

    this.validateTelemetry(() => {
      this.reporters.forEach(reporter => {
        reporter.sendTelemetryEvent('activationEvent', properties, measurements);
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
    startTime?: number | [number, number],
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

        const convertedStartTime = this.hrTimeToMilliseconds(startTime);

        let aggregatedMeasurements: Measurements | undefined;
        if (convertedStartTime || measurements) {
          aggregatedMeasurements = { ...measurements };
          if (convertedStartTime) {
            aggregatedMeasurements.executionTime = TimingUtils.getElapsedTime(convertedStartTime);
          }
        }
        this.reporters.forEach(reporter => {
          reporter.sendTelemetryEvent('commandExecution', aggregatedProps, aggregatedMeasurements);
        });
      }
    });
  }

  public sendException(name: string, message: string) {
    this.validateTelemetry(() => {
      this.reporters.forEach(reporter => {
        try {
          reporter.sendExceptionEvent(name, message);
        } catch {
          console.log(
            `There was an error sending an exception report to: ${typeof reporter} ` +
            `name: ${String(name)} message: ${String(message)}`
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

const extensionPackageJsonSchema = z.object({
  name: z.string({ message: 'Extension name is not defined in package.json' }),
  version: z.string({ message: 'Extension version is not defined in package.json' }),
  aiKey: z.string().optional(),
  o11yUploadEndpoint: z.string().optional(),
  enableO11y: z.string().optional()
});
