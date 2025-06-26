/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TelemetryReporter } from '@salesforce/vscode-service-provider';
import * as path from 'node:path';
import { Disposable, Uri, workspace } from 'vscode';
import { WorkspaceContextUtil } from '../../context/workspaceContextUtil';

/**
 * Represents a telemetry reporter that logs telemetry events to a file.
 */
export class LogStream extends Disposable implements TelemetryReporter {
  private toDispose: Disposable[] = [];
  private logUri: Uri;
  private buffer: string = '';

  constructor(
    private extensionId: string,
    logFilePath: string
  ) {
    super(() => this.toDispose.forEach(d => d?.dispose()));
    this.logUri = Uri.file(path.join(logFilePath, `${this.extensionId}.txt`));
    this.toDispose.push(workspace.onDidChangeConfiguration(() => () => {}));
    console.log(
      `VS Code telemetry event logging enabled for: ${this.extensionId}. Telemetry events will be written via write stream to a file at: ${this.logUri.fsPath}.`
    );
  }

  private async appendToFile(content: string): Promise<void> {
    try {
      this.buffer += content;
      await workspace.fs.writeFile(this.logUri, Buffer.from(this.buffer));
    } catch (error) {
      console.error('Failed to write telemetry log:', error);
    }
  }

  public sendTelemetryEvent(
    eventName: string,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number }
  ): void {
    const orgId = WorkspaceContextUtil.getInstance().orgId;
    if (orgId && properties) {
      properties.orgId = orgId;
    } else if (orgId) {
      properties = { orgId };
    }

    void this.appendToFile(
      `telemetry/${eventName} ${JSON.stringify({
        properties,
        measurements
      })}\n`
    );
  }

  public sendExceptionEvent(
    exceptionName: string,
    exceptionMessage: string,
    measurements?: { [key: string]: number }
  ): void {
    const orgId = WorkspaceContextUtil.getInstance().orgId || '';
    const properties = { orgId };
    console.log('LogStream.sendExceptionEvent - exceptionMessage: ' + exceptionMessage);

    void this.appendToFile(
      `telemetry/${exceptionName} ${JSON.stringify({
        properties,
        measurements
      })}\n`
    );
  }

  public async dispose(): Promise<void> {
    if (this.buffer) {
      void this.appendToFile('');
    }
  }
}
