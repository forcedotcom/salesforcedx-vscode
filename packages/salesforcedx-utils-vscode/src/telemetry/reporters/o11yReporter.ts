/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

'use strict';

import { TelemetryReporter } from '@salesforce/vscode-service-provider';
import { Disposable, workspace } from 'vscode';
import { WorkspaceContextUtil } from '../../context/workspaceContextUtil';
import { O11yService } from '../../services/o11yService';

export class O11yReporter extends Disposable implements TelemetryReporter {
  private userOptIn: boolean = false;
  private o11yUploadEndpoint: string;
  private toDispose: Disposable[] = [];
  private readonly o11yService: O11yService;

  // user defined tag to add to properties that is defined via setting
  private telemetryTag: string | undefined;

  constructor(
    private extensionId: string,
    o11yUploadEndpoint: string
  ) {
    super(() => this.toDispose.forEach(d => d && d.dispose()));
    this.o11yService = O11yService.getInstance();
    this.userOptIn = true; // Assume opt-in for now
    this.o11yUploadEndpoint = o11yUploadEndpoint;
    this.setTelemetryTag();
  }

  public async initialize(extensionName: string): Promise<void> {
    await this.o11yService.initialize(extensionName, this.o11yUploadEndpoint);
  }

  public sendTelemetryEvent(
    eventName: string,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number }
  ): void {
    if (this.userOptIn && eventName) {
      const orgId = WorkspaceContextUtil.getInstance().orgId;
      const orgShape = WorkspaceContextUtil.getInstance().orgShape || '';
      const devHubId = WorkspaceContextUtil.getInstance().devHubId || '';
      let props = properties ? properties : {};
      props = this.applyTelemetryTag(orgId ? { ...props, orgId, orgShape, devHubId } : props);

      this.o11yService.logEvent({
        name: `${this.extensionId}/${eventName}`,
        // tslint:disable-next-line:object-literal-shorthand
        properties: props,
        // tslint:disable-next-line:object-literal-shorthand
        measurements
      });
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.o11yService.upload();
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

      const orgId = WorkspaceContextUtil.getInstance().orgId || '';
      const orgShape = WorkspaceContextUtil.getInstance().orgShape || '';
      const devHubId = WorkspaceContextUtil.getInstance().devHubId || '';
      const properties = this.applyTelemetryTag({ orgId, orgShape, devHubId });
      this.o11yService.logEvent({
        exception: error,
        properties,
        measurements
      });

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.o11yService.upload();
    }
  }

  public async dispose(): Promise<void> {
    await this.o11yService.upload();
  }

  /**
   * Helper to set reporter's telemetryTag from setting salesforcedx-vscode-core.telemetry-tag
   * @returns string | undefined
   */
  private setTelemetryTag(): void {
    const config = workspace.getConfiguration();
    this.telemetryTag = config?.get('salesforcedx-vscode-core.telemetry-tag') || undefined;
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
