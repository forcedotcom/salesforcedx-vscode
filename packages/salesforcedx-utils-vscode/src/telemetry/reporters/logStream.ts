/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable prettier/prettier */
'use strict';

import { TelemetryReporter } from '@salesforce/vscode-service-provider';
import * as fs from 'fs';
import * as path from 'path';
import { Disposable, workspace } from 'vscode';
import { WorkspaceContextUtil } from '../../context/workspaceContextUtil';

/**
 * Represents a telemetry reporter that logs telemetry events to a file.
 */
export class LogStream extends Disposable implements TelemetryReporter {
  private toDispose: Disposable[] = [];

  private stream: fs.WriteStream | undefined;

  constructor(
    private extensionId: string,
    private logFilePath: string
  ) {
    super(() => this.toDispose.forEach(d => d && d.dispose()));
    logFilePath = path.join(logFilePath, `${this.extensionId}.txt`);
    this.stream = fs.createWriteStream(logFilePath, {
      flags: 'a',
      encoding: 'utf8',
      autoClose: true
    });
    this.toDispose.push(workspace.onDidChangeConfiguration(() => () => { }));
    console.log(
      'VS Code telemetry event logging enabled for: ' +
      this.extensionId +
      '. Telemetry events will be written via write stream to a file at: ' +
      this.logFilePath +
      '.'
    );
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

    if (this.stream) {
      this.stream.write(
        `telemetry/${eventName} ${JSON.stringify({
          properties,
          measurements
        })}\n`
      );
    }
  }

  public sendExceptionEvent(
    exceptionName: string,
    exceptionMessage: string,
    measurements?: { [key: string]: number }
  ): void {
    const orgId = WorkspaceContextUtil.getInstance().orgId || '';
    const properties = { orgId };
    console.log('LogStream.sendExceptionEvent - exceptionMessage: ' + exceptionMessage);

    if (this.stream) {
      this.stream.write(
        `telemetry/${exceptionName} ${JSON.stringify({
          properties,
          measurements
        })}\n`
      );
    }
  }

  public dispose(): Promise<any> {
    const flushEventsToLogger = new Promise<any>(resolve => {
      if (!this.stream) {
        return resolve(void 0);
      }
      this.stream.on('finish', () => resolve(void 0));
      this.stream.end();
    });

    return flushEventsToLogger;
  }
}
