/* eslint-disable header/header */
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import * as fs from 'fs';
import * as path from 'path';
import { Disposable, workspace } from 'vscode';
import { WorkspaceContextUtil } from '../../context/workspaceContextUtil';
import { TelemetryReporter } from '../interfaces';

export class LogStream extends Disposable implements TelemetryReporter {
  private toDispose: Disposable[] = [];

  private logStream: fs.WriteStream | undefined;

  constructor(
    private extensionId: string,
    logFilePath: string
  ) {
    super(() => this.toDispose.forEach(d => d && d.dispose()));
    logFilePath = path.join(logFilePath, `${this.extensionId}.txt`);
    this.logStream = fs.createWriteStream(logFilePath, {
      flags: 'a',
      encoding: 'utf8',
      autoClose: true
    });
    this.toDispose.push(workspace.onDidChangeConfiguration(() => () => {}));
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

    if (this.logStream) {
      this.logStream.write(
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
    const error = new Error();
    error.name = `${this.extensionId}/${exceptionName}`;
    error.message = exceptionMessage;
    error.stack = 'DEPRECATED';

    const orgId = WorkspaceContextUtil.getInstance().orgId || '';
    const properties = { orgId };

    if (this.logStream) {
      this.logStream.write(
        `telemetry/${exceptionName} ${JSON.stringify({
          properties,
          measurements
        })}\n`
      );
    }
  }

  public dispose(): Promise<any> {
    const flushEventsToLogger = new Promise<any>(resolve => {
      if (!this.logStream) {
        return resolve(void 0);
      }
      this.logStream.on('finish', resolve);
      this.logStream.end();
    });

    return Promise.all([flushEventsToLogger]);
  }
}