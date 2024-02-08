/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import * as path from 'path';
import { getRootWorkspacePath } from '../..';
import { LOCAL_TELEMETRY_FILE } from '../../constants';
import { TelemetryReporter } from '../interfaces';

export class TelemetryFile implements TelemetryReporter {
  constructor(private extensionId: string) {}

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

    await fs.promises.appendFile(
      this.logFilePath(),
      JSON.stringify({ timestamp, command, data }, null, 2) + ','
    );
  }

  private logFilePath(): fs.PathLike | fs.promises.FileHandle {
    return path.join(
      getRootWorkspacePath(),
      `${this.extensionId}-${LOCAL_TELEMETRY_FILE}`
    );
  }
}
