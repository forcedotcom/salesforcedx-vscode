/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TelemetryReporter } from '@salesforce/vscode-service-provider';
import * as fs from 'fs';
import * as path from 'path';
import { getRootWorkspacePath } from '../..';
import { LOCAL_TELEMETRY_FILE } from '../../constants';

/**
 * Represents a telemetry file that logs telemetry events by appending to a local file.
 */
export class TelemetryFile implements TelemetryReporter {
  private filePath: string;

  constructor(extensionId: string) {
    this.filePath = this.logFilePathFor(extensionId);
    console.log(
      'Local telemetry event logging enabled for: ' +
        extensionId +
        '. Telemetry events will be appended to the file at: ' +
        this.filePath +
        '.'
    );
  }

  public sendTelemetryEvent(
    eventName: string,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number }
  ): void {
    void this.writeToFile(eventName, { ...properties, ...measurements });
  }

  public sendExceptionEvent(
    exceptionName: string,
    exceptionMessage: string,
    measurements?: { [key: string]: number }
  ): void {
    void this.writeToFile(exceptionName, { exceptionMessage, ...measurements });
  }

  public dispose(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('dispose called on Local Telemetry Logger.');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Writes telemetry data to a local file.
   * @param command - The command associated with the telemetry data.
   * @param data - The telemetry data to be written.
   */
  private async writeToFile(
    command: string,
    data: {
      [key: string]: string | number;
    }
  ) {
    const timestamp = new Date().toISOString();

    await fs.promises.appendFile(this.filePath, JSON.stringify({ timestamp, command, data }, null, 2) + ',');
  }

  private logFilePathFor(extensionId: string): string {
    return path.join(getRootWorkspacePath(), `${extensionId}-${LOCAL_TELEMETRY_FILE}`);
  }
}
