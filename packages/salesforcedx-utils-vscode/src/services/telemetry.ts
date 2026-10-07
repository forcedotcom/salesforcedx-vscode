/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { getServicesApi, type SalesforceVSCodeServicesApi } from '@salesforce/effect-ext-utils';
import { errorToString } from '@salesforce/salesforcedx-utils';
import {
  Properties,
  Measurements,
  TelemetryData,
  TelemetryReporter,
  TelemetryServiceInterface,
  ActivationInfo
} from '@salesforce/vscode-service-provider';
import * as Effect from 'effect/Effect';
import { isNotUndefined, isString } from 'effect/Predicate';
import { ExtensionContext, ExtensionMode, workspace } from 'vscode';
import { SFDX_CORE_CONFIGURATION_NAME, SFDX_CORE_EXTENSION_NAME, SFDX_EXTENSION_PACK_NAME } from '../constants';
import { isCLITelemetryAllowed } from '../telemetry/cliConfiguration';
import { extensionPackageJsonSchema } from '../telemetry/schema';
import { isInternalHost } from '../telemetry/utils/isInternal';

type CommandMetric = {
  extensionName: string;
  commandName: string;
  executionTime?: string;
};

type TelemetrySender = ReturnType<SalesforceVSCodeServicesApi['services']['getLegacyTelemetrySender']>;
type TelemetryPayload = Parameters<TelemetrySender>[0];

// export only for unit test
export class TelemetryServiceProvider {
  public static instances = new Map<string, TelemetryService>(); // public only for unit test
  public static getInstance(extensionName?: string): TelemetryServiceInterface {
    // default if not present
    const name = extensionName ?? SFDX_CORE_EXTENSION_NAME;
    if (!extensionName) {
      console.log(`[TelemetryServiceProvider] No extensionName provided. Defaulting to "${SFDX_CORE_EXTENSION_NAME}".`);
    }
    const service = TelemetryServiceProvider.instances.get(name) ?? new TelemetryService();
    TelemetryServiceProvider.instances.set(name, service);
    return service;
  }
}

export class TelemetryService implements TelemetryServiceInterface {
  private sendProductionTelemetry: TelemetrySender | undefined;
  private disposed = false;
  private pendingTelemetry = new Set<Promise<void>>();
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
      return seconds * 1000 + nanoseconds / 1_000_000;
    }
  }

  public getEndHRTime(hrstart: [number, number]): number {
    const endTime = performance.now();
    const startTimeMs = this.hrTimeToMilliseconds(hrstart);
    return startTimeMs ? endTime - startTimeMs : -1;
  }

  /**
   * Initialize Telemetry Service during extension activation.
   * @param extensionContext extension context
   */
  public async initializeService(extensionContext: ExtensionContext): Promise<void> {
    const { name } = extensionPackageJsonSchema.parse(extensionContext.extension.packageJSON);
    this.extensionName = name;
    this.isInternal = isInternalHost();
    this.isDevMode = extensionContext.extensionMode !== ExtensionMode.Production;

    // prime the memoized CLI opt-out lookup so the reporter checks below don't pay for it during activation
    await this.checkCliTelemetry().catch(error => {
      console.log(`Error initializing telemetry service: ${errorToString(error)}`);
    });

    if (!this.sendProductionTelemetry && (await this.isTelemetryEnabled())) {
      // sender built once per instance from ExtensionContext, cached exporters live in services
      const api = await Effect.runPromise(getServicesApi);
      this.sendProductionTelemetry = api.services.getLegacyTelemetrySender(extensionContext);
    }
    if (!extensionContext.subscriptions.includes(this)) extensionContext.subscriptions.push(this);
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
    return [];
  }

  public async isTelemetryEnabled(): Promise<boolean> {
    return this.isInternal ? true : this.isTelemetryExtensionConfigurationEnabled() && (await this.checkCliTelemetry());
  }

  public async checkCliTelemetry(): Promise<boolean> {
    if (isNotUndefined(this.cliAllowsTelemetryPromise)) {
      return this.cliAllowsTelemetryPromise;
    }
    this.cliAllowsTelemetryPromise = isCLITelemetryAllowed();
    return await this.cliAllowsTelemetryPromise;
  }

  /** Duplicated by necessity in vscode-services (salesforcedx-vscode-services/src/terminal/terminalService.ts
   * `isVscodeTelemetryOff`, which gates SF_DISABLE_TELEMETRY for `sf ` execs) because that package cannot depend
   * on utils-vscode — keep the two settings checked here in sync with it. */
  public isTelemetryExtensionConfigurationEnabled(): boolean {
    return (
      workspace.getConfiguration('telemetry').get<string>('telemetryLevel', 'all') !== 'off' &&
      workspace.getConfiguration(SFDX_CORE_CONFIGURATION_NAME).get<boolean>('telemetry.enabled', true)
    );
  }

  /** No-op: exists only to satisfy the external TelemetryServiceInterface contract. The CLI telemetry
   * opt-out is computed per-exec in TerminalService (vscode-services), so nothing is pushed from here. */
  public setCliTelemetryEnabled(_isEnabled: boolean): void {}

  public sendActivationEventInfo(activationInfo: ActivationInfo) {
    this.sendExtensionActivationEvent(activationInfo.startActivateHrTime, activationInfo.markEndTime, {
      properties: stripEmptyValues({
        activateStartDate: activationInfo.activateStartDate.toISOString(),
        activateEndDate: activationInfo.activateEndDate?.toISOString(),
        loadStartDate: activationInfo.loadStartDate?.toISOString()
      }),
      measurements: {
        extensionActivationTime: activationInfo.extensionActivationTime
      }
    });
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
      startupTime = markEndTime ?? globalThis.performance.now() - convertedStartTime;
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

    this.sendTelemetryItem({ kind: 'event', name: 'activationEvent', properties, measurements });
  }

  public sendExtensionDeactivationEvent(): void {
    this.sendTelemetryItem({
      kind: 'event',
      name: 'deactivationEvent',
      properties: { extensionName: this.extensionName }
    });
  }

  public sendCommandEvent(
    commandName?: string,
    startTime?: number | [number, number],
    properties?: Properties,
    measurements?: Measurements
  ): void {
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
          aggregatedMeasurements.executionTime = globalThis.performance.now() - convertedStartTime;
        }
      }
      this.sendTelemetryItem({
        kind: 'event',
        name: 'commandExecution',
        properties: aggregatedProps,
        measurements: aggregatedMeasurements
      });
    }
  }

  public sendException(name: string, message: string) {
    this.sendTelemetryItem({ kind: 'exception', name, message });
  }

  public sendEventData(
    eventName: string,
    properties?: { [key: string]: string },
    measures?: { [key: string]: number }
  ): void {
    this.sendTelemetryItem({ kind: 'event', name: eventName, properties, measurements: measures });
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    void Promise.allSettled(this.pendingTelemetry).catch(err => console.log(err));
  }

  /**
   * Helper to run a callback if telemetry has been initialized and is
   * enabled.
   *
   * @param callback function to call if telemetry is enabled
   */
  private sendTelemetryItem(item: TelemetryPayload): void {
    if (this.disposed || !this.sendProductionTelemetry) return;
    const payload: TelemetryPayload = Object.freeze({
      ...item,
      properties: item.properties ? Object.freeze({ ...item.properties }) : undefined,
      measurements: item.measurements ? Object.freeze({ ...item.measurements }) : undefined
    });
    // Services captures its DefaultOrgInfo snapshot synchronously here, before
    // telemetry opt-in checks can yield or the target org can change.
    const send = this.sendProductionTelemetry(payload);
    const pending = Promise.resolve(
      this.validateTelemetry(async () => {
        await send();
      })
    );
    this.pendingTelemetry.add(pending);
    void pending.finally(() => this.pendingTelemetry.delete(pending));
  }

  private async validateTelemetry(callback: () => void | Promise<void>): Promise<void> {
    if (this.disposed || !this.sendProductionTelemetry) return;
    try {
      if (await this.isTelemetryEnabled()) await callback();
    } catch (err) {
      console.error(err);
    }
  }
}

const stripEmptyValues = (obj: Record<string, string | undefined | null>): Record<string, string> =>
  Object.fromEntries(Object.entries(obj).filter(isStringEntry));

const isStringEntry = (entry: [string, unknown]): entry is [string, string] => isString(entry[1]);
