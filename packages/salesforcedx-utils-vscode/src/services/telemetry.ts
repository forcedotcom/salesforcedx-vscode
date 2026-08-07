/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { getServicesApi, type SalesforceVSCodeServicesApi } from '@salesforce/effect-ext-utils';
import { isLoopbackHttpEndpoint } from '@salesforce/salesforcedx-utils';
import {
  Properties,
  Measurements,
  TelemetryData,
  TelemetryReporter,
  TelemetryServiceInterface,
  ActivationInfo
} from '@salesforce/vscode-service-provider';
import * as Effect from 'effect/Effect';
import { isNotUndefined, isString, isUndefined } from 'effect/Predicate';
import { ExtensionContext, ExtensionMode, extensions, workspace } from 'vscode';
import { ChannelService } from '../commands/channelService';
import {
  DEFAULT_AIKEY,
  SFDX_CORE_CONFIGURATION_NAME,
  SFDX_CORE_EXTENSION_NAME,
  SFDX_EXTENSION_PACK_NAME,
  UNAUTHENTICATED_USER
} from '../constants';
import { shapeFrom } from '../context/workspaceOrgShape';
import { errorToString } from '../helpers/errorUtils';
import { isCLITelemetryAllowed } from '../telemetry/cliConfiguration';
import { AppInsights } from '../telemetry/reporters/appInsights';
import {
  determineLocalReporters,
  determineReporters,
  initializeO11yReporter
} from '../telemetry/reporters/determineReporters';
import { LogStream } from '../telemetry/reporters/logStream';
import { O11yReporter } from '../telemetry/reporters/o11yReporter';
import { TelemetryFile } from '../telemetry/reporters/telemetryFile';
import { OrgIdentity, TelemetryReporterConfig } from '../telemetry/reporters/telemetryReporterConfig';
import { extensionPackageJsonSchema } from '../telemetry/schema';
import { isInternalHost } from '../telemetry/utils/isInternal';

type IdentityFromServices = {
  cliId: string | undefined;
  webUserId: string;
  telemetryClassification: 'gov' | 'nonGov' | 'unknown';
} & OrgIdentity;

const identityFromSnapshot = (
  snapshot: ReturnType<SalesforceVSCodeServicesApi['services']['TelemetryIdentitySnapshot']>
): IdentityFromServices => ({
  cliId: snapshot.cliId,
  webUserId: snapshot.webUserId ?? UNAUTHENTICATED_USER,
  orgId: snapshot.orgId,
  orgShape: shapeFrom(snapshot),
  devHubId: snapshot.devHubOrgId,
  orgEdition: snapshot.orgEdition,
  telemetryClassification: snapshot.telemetryClassification
});

const getIdentitySnapshotFromServices = (): IdentityFromServices => {
  const extension = extensions.getExtension<SalesforceVSCodeServicesApi>('salesforce.salesforcedx-vscode-services');
  if (!extension?.isActive) throw new Error('Salesforce VS Code Services extension is not active');
  return identityFromSnapshot(extension.exports.services.TelemetryIdentitySnapshot());
};

/** Pull telemetry identity from the services extension. */
const fetchIdentityFromServices = (): Promise<IdentityFromServices> =>
  Effect.runPromise(
    getServicesApi.pipe(Effect.map(api => identityFromSnapshot(api.services.TelemetryIdentitySnapshot())))
  );

type CommandMetric = {
  extensionName: string;
  commandName: string;
  executionTime?: string;
};

type TelemetryPayload = Readonly<{
  kind: 'event' | 'exception';
  name: string;
  message?: string;
  properties?: Readonly<Properties>;
  measurements?: Readonly<Measurements>;
  identity: Readonly<IdentityFromServices>;
  productFeatureId?: string;
}>;

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
  private extensionContext: ExtensionContext | undefined;
  private reporters: TelemetryReporter[] = [];
  private productionReporters: (AppInsights | O11yReporter)[] = [];
  private sendProductionTelemetry: ((payload: TelemetryPayload) => Promise<void>) | undefined;
  private productFeatureId: string | undefined;
  private disposed = false;
  private pendingTelemetry = new Set<Promise<void>>();
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
      return seconds * 1000 + nanoseconds / 1_000_000;
    }
  }

  public getEndHRTime(hrstart: [number, number]): number {
    const endTime = performance.now();
    const startTimeMs = this.hrTimeToMilliseconds(hrstart);
    return startTimeMs ? endTime - startTimeMs : -1;
  }

  /**
   * Fetch telemetry identity from the services extension.
   * @internal Public only as a jest spy hook; do not invoke from outside this file.
   */
  public getIdentityFromServices(): Promise<IdentityFromServices> {
    return fetchIdentityFromServices();
  }

  private warnDegradedSession(cliId: string | undefined): void {
    if (isUndefined(cliId)) {
      ChannelService.getInstance(this.extensionName).appendLine('telemetry seed missing — degraded session');
    }
  }

  /**
   * Initialize Telemetry Service during extension activation.
   * @param extensionContext extension context
   */
  public async initializeService(extensionContext: ExtensionContext): Promise<void> {
    const { name, version, aiKey, o11yUploadEndpoint, enableO11y, productFeatureId } = extensionPackageJsonSchema.parse(
      extensionContext.extension.packageJSON
    );
    this.extensionContext = extensionContext;
    this.extensionName = name;
    this.version = version;
    this.aiKey ??= aiKey ?? DEFAULT_AIKEY;
    this.isInternal = isInternalHost();
    this.isDevMode = extensionContext.extensionMode !== ExtensionMode.Production;

    // prime the memoized CLI opt-out lookup so the reporter checks below don't pay for it during activation
    await this.checkCliTelemetry().catch(error => {
      console.log(`Error initializing telemetry service: ${errorToString(error)}`);
    });

    if (this.reporters.length === 0 && !this.sendProductionTelemetry && (await this.isTelemetryEnabled())) {
      const identity = await this.getIdentityFromServices();
      const { cliId, webUserId } = identity;
      this.warnDegradedSession(cliId);
      const userId = cliId ?? '';
      const reporterConfig: TelemetryReporterConfig = {
        extName: this.extensionName,
        version: this.version,
        aiKey: this.aiKey,
        userId,
        reporterName: this.getTelemetryReporterName(),
        isDevMode: this.isDevMode,
        webUserId
      };

      this.productFeatureId = productFeatureId;
      const localO11yEndpoint =
        this.isDevMode && isLoopbackHttpEndpoint(process.env.O11Y_ENDPOINT) ? process.env.O11Y_ENDPOINT : undefined;
      const resolvedO11yEndpoint = localO11yEndpoint ?? o11yUploadEndpoint;
      if (this.isDevMode && enableO11y && resolvedO11yEndpoint) {
        await initializeO11yReporter(
          reporterConfig.extName,
          resolvedO11yEndpoint,
          userId,
          version,
          webUserId,
          productFeatureId,
          Boolean(localO11yEndpoint)
        );
      }
      this.reporters.push(
        ...(this.isDevMode ? determineReporters(reporterConfig) : determineLocalReporters(reporterConfig))
      );
      if (!this.isDevMode) {
        this.sendProductionTelemetry = this.makeProductionSender(
          reporterConfig,
          enableO11y ? resolvedO11yEndpoint : undefined
        );
      }
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
    return [...this.reporters, ...this.productionReporters];
  }

  /**
   * Refreshes telemetry reporters with the latest user ID and webUserId field when org authorization changes.
   * This ensures that telemetry events use the correct webUserId field (hashed orgId + userId)
   * while maintaining the original user ID calculation.
   *
   * extensionContext is used to access globalState
   */
  public async updateReporters(extensionContext: ExtensionContext): Promise<void> {
    if (
      !this.extensionContext ||
      (this.reporters.length === 0 && !this.sendProductionTelemetry) ||
      !(await this.isTelemetryEnabled())
    ) {
      return;
    }

    // Sourced from services-owned identity; webUserId always defined (UNAUTHENTICATED_USER until auth).
    const { cliId, webUserId, orgId, orgShape, devHubId, orgEdition } = await this.getIdentityFromServices();
    this.warnDegradedSession(cliId);
    const userId = cliId ?? '';
    const orgIdentity = { orgId, orgShape, devHubId, orgEdition };

    // priority: extension specific one, OR core default one, OR original one
    const { productFeatureId: thisExtensionPftId } = extensionPackageJsonSchema.parse(
      this.extensionContext!.extension.packageJSON
    );
    const { productFeatureId: coreEtensionPftId } = extensionPackageJsonSchema.parse(
      extensionContext.extension.packageJSON
    );
    // fresh object per reporter — avoid aliasing one shared-mutable orgIdentity across instances
    this.reporters
      .filter(r => r instanceof TelemetryFile || r instanceof LogStream)
      // TelemetryFile/LogStream lack userId/webUserId — cache org identity only.
      .forEach(r => (r.orgIdentity = { ...orgIdentity }));
    this.reporters
      .filter(r => r instanceof AppInsights || r instanceof O11yReporter)
      .forEach(r => {
        r.userId = userId;
        r.webUserId = webUserId;
        r.orgIdentity = { ...orgIdentity };
      });
    this.reporters
      .filter(r => r instanceof O11yReporter)
      // don't overwrite PFT if already set
      .filter(r => isUndefined(r.productFeatureId))
      .forEach(r => (r.productFeatureId = thisExtensionPftId ?? coreEtensionPftId));
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
    void Promise.allSettled(this.pendingTelemetry)
      .then(() =>
        Promise.allSettled([
          ...this.reporters.map(reporter => Promise.resolve().then(() => reporter.dispose())),
          ...this.productionReporters.map(reporter => reporter.dispose())
        ])
      )
      .catch(err => console.log(err));
  }

  /**
   * Helper to run a callback if telemetry has been initialized and is
   * enabled.
   *
   * @param callback function to call if telemetry is enabled
   */
  private sendTelemetryItem(item: Omit<TelemetryPayload, 'identity' | 'productFeatureId'>): void {
    const identity = getIdentitySnapshotFromServices();
    const payload: TelemetryPayload = Object.freeze({
      ...item,
      properties: item.properties ? Object.freeze({ ...item.properties }) : undefined,
      measurements: item.measurements ? Object.freeze({ ...item.measurements }) : undefined,
      identity: Object.freeze({ ...identity }),
      productFeatureId: this.productFeatureId
    });
    const pending = Promise.resolve(
      this.validateTelemetry(async () => {
        this.reporters.map(reporter => {
          try {
            this.sendToReporter(reporter, payload);
          } catch (error) {
            console.error(error);
          }
        });
        await this.sendProductionTelemetry?.(payload);
      })
    );
    this.pendingTelemetry.add(pending);
    void pending.finally(() => this.pendingTelemetry.delete(pending));
  }

  private async validateTelemetry(callback: () => void | Promise<void>): Promise<void> {
    if (this.disposed || (this.reporters.length === 0 && !this.sendProductionTelemetry)) return;
    try {
      if (await this.isTelemetryEnabled()) await callback();
    } catch (err) {
      console.error(err);
    }
  }

  private sendToReporter(reporter: TelemetryReporter, payload: TelemetryPayload): void {
    if (payload.kind === 'event') {
      reporter.sendTelemetryEvent(payload.name, payload.properties, payload.measurements);
      return;
    }
    reporter.sendExceptionEvent(payload.name, payload.message ?? '', payload.measurements);
  }

  private makeProductionSender(
    config: TelemetryReporterConfig,
    o11yUploadEndpoint: string | undefined
  ): (payload: TelemetryPayload) => Promise<void> {
    const initializeAppInsights = this.stickyReporterInitialization(() =>
      Promise.resolve(
        new AppInsights(config.reporterName, config.version, config.aiKey, config.userId, config.webUserId, true)
      )
    );
    const initializeO11y = o11yUploadEndpoint
      ? this.stickyReporterInitialization(async () => {
          const reporter = new O11yReporter(
            config.extName,
            config.version,
            o11yUploadEndpoint,
            config.userId,
            config.webUserId,
            this.productFeatureId
          );
          await reporter.initialize(config.extName);
          return reporter;
        })
      : undefined;
    const sendWith = async (
      label: string,
      initialize: (() => Promise<AppInsights | O11yReporter>) | undefined,
      payload: TelemetryPayload
    ) => {
      if (!initialize) return;
      try {
        const reporter = await initialize();
        if (!this.productionReporters.includes(reporter)) this.productionReporters.push(reporter);
        const { identity, productFeatureId } = payload;
        reporter.userId = identity.cliId ?? '';
        reporter.webUserId = identity.webUserId;
        reporter.orgIdentity = {
          orgId: identity.orgId,
          orgShape: identity.orgShape,
          devHubId: identity.devHubId,
          orgEdition: identity.orgEdition
        };
        if (reporter instanceof O11yReporter) reporter.productFeatureId = productFeatureId;
        this.sendToReporter(reporter, payload);
      } catch (error) {
        console.error(`${label} telemetry failed:`, error);
      }
    };
    return async payload => {
      if (payload.identity.telemetryClassification !== 'nonGov' || !(await this.isTelemetryEnabled())) return;
      await Promise.allSettled([
        sendWith('App Insights', initializeAppInsights, payload),
        sendWith('O11y', initializeO11y, payload)
      ]);
    };
  }

  private stickyReporterInitialization<Reporter>(initialize: () => Promise<Reporter>): () => Promise<Reporter> {
    const initialized: { promise?: Promise<Reporter> } = {};
    return () => (initialized.promise ??= Promise.resolve().then(initialize));
  }
}

const stripEmptyValues = (obj: Record<string, string | undefined | null>): Record<string, string> =>
  Object.fromEntries(Object.entries(obj).filter(isStringEntry));

const isStringEntry = (entry: [string, unknown]): entry is [string, string] => isString(entry[1]);

export const telemetryService = TelemetryServiceProvider.getInstance();
