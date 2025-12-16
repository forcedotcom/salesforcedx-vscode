/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { TelemetryReporterWithModifiableUserProperties } from './telemetryReporterConfig';
import { O11yService } from '@salesforce/o11y-reporter';
import type { TelemetryReporter } from '@salesforce/vscode-service-provider';
import { Disposable, env, workspace } from 'vscode';
import { WorkspaceContextUtil } from '../../context/workspaceContextUtil';
import { isInternalHost } from '../utils/isInternal';
import { getCommonProperties, getInternalProperties } from './telemetryUtils';

export class O11yReporter
  extends Disposable
  implements TelemetryReporter, TelemetryReporterWithModifiableUserProperties
{
  private userOptIn: boolean = false;
  private o11yUploadEndpoint: string;
  private toDispose: Disposable[] = [];
  private readonly o11yService: O11yService;
  private batchingCleanup: (() => void) | null = null;

  // user defined tag to add to properties that is defined via setting
  private telemetryTag: string | undefined;

  constructor(
    private extensionId: string,
    private extensionVersion: string,
    o11yUploadEndpoint: string,
    public userId: string,
    public webUserId: string
  ) {
    super(() => {
      this.toDispose.forEach(d => {
        d?.dispose();
      });
    });
    this.o11yService = O11yService.getInstance(extensionId);
    this.userOptIn = true; // Assume opt-in for now
    this.o11yUploadEndpoint = o11yUploadEndpoint;
    this.setTelemetryTag();
  }

  public async initialize(extensionName: string): Promise<void> {
    await this.o11yService.initialize(extensionName, this.o11yUploadEndpoint);

    // Enable automatic batching with 30-second periodic flush
    this.batchingCleanup = this.o11yService.enableAutoBatching({
      flushInterval: 30_000, // 30 seconds
      enableShutdownHook: true // Ensure events are flushed on shutdown
    });
  }

  private getUserProperties(): Record<string, string> {
    return {
      user_Id: this.userId,
      session_Id: env.sessionId
    };
  }

  private aggregateLoggingProperties(): { [key: string]: string } {
    const commonProperties = {
      ...this.getUserProperties(),
      ...getCommonProperties(this.extensionId, this.extensionVersion)
    };
    return isInternalHost() ? { ...commonProperties, ...getInternalProperties() } : commonProperties;
  }

  public sendTelemetryEvent(
    eventName: string,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number }
  ): void {
    if (this.userOptIn && eventName) {
      const orgId = WorkspaceContextUtil.getInstance().orgId ?? '';
      const orgShape = WorkspaceContextUtil.getInstance().orgShape ?? '';
      const devHubId = WorkspaceContextUtil.getInstance().devHubId ?? '';

      // Add webUserId field to customDimensions
      let props = properties
        ? { ...properties, ...this.aggregateLoggingProperties() }
        : { ...this.aggregateLoggingProperties() };
      props = this.applyTelemetryTag(
        orgId
          ? { ...props, orgId, orgShape, devHubId, webUserId: this.webUserId }
          : { ...props, webUserId: this.webUserId }
      );

      this.o11yService.logEvent({
        name: `${this.extensionId}/${eventName}`,
        properties: props,
        measurements
      });

      // Batching is enabled - no need to upload after each event
      // Events will be automatically batched and uploaded based on threshold (50KB) or periodic flush (30s)
    }
  }

  public sendExceptionEvent(
    exceptionName: string,
    exceptionMessage: string,
    measurements?: { [key: string]: number }
  ): void {
    if (this.userOptIn && exceptionMessage) {
      const error = new Error();
      error.name = `${this.extensionId}/${exceptionName}`;
      error.message = exceptionMessage;
      error.stack = 'DEPRECATED';

      const orgId = WorkspaceContextUtil.getInstance().orgId ?? '';
      const orgShape = WorkspaceContextUtil.getInstance().orgShape ?? '';
      const devHubId = WorkspaceContextUtil.getInstance().devHubId ?? '';

      // Add webUserId field to customDimensions
      const baseProps = { orgId, orgShape, devHubId };
      const props = this.applyTelemetryTag({
        ...baseProps,
        ...this.aggregateLoggingProperties(),
        webUserId: this.webUserId
      });

      this.o11yService.logEvent({
        exception: error,
        properties: props,
        measurements
      });

      // Batching is enabled - no need to upload after each event
      // Events will be automatically batched and uploaded based on threshold (50KB) or periodic flush (30s)
    }
  }

  public async dispose(): Promise<void> {
    // Cleanup batching (removes timers and shutdown hooks)
    if (this.batchingCleanup) {
      this.batchingCleanup();
      this.batchingCleanup = null;
    }

    // Force final flush of any remaining events
    await this.o11yService.forceFlush();
  }

  /**
   * Helper to set reporter's telemetryTag from setting salesforcedx-vscode-core.telemetry-tag
   * @returns string | undefined
   */
  private setTelemetryTag(): void {
    const config = workspace.getConfiguration();
    this.telemetryTag = config?.get('salesforcedx-vscode-core.telemetry-tag') ?? undefined;
  }

  /**
   * Helper to include telemetryTag in properties if it exists
   * if not, return properties as is
   *
   * @param properties
   * @returns
   */
  private applyTelemetryTag(properties: { [key: string]: string }): {
    [key: string]: string;
  } {
    return this.telemetryTag ? { ...properties, telemetryTag: this.telemetryTag } : properties;
  }
}
