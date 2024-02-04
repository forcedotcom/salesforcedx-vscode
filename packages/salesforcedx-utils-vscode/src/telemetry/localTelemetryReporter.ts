/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { appendFile } from 'fs';
import { LOCAL_TELEMETRY_FILE } from '../constants';
import { TelemetryReporterInterface } from './TelemetryReporterInterface';

export class LocalTelemetryReporter implements TelemetryReporterInterface {
  appInsightsClient: undefined;
  userOptIn: undefined;
  logStream: undefined;

  sendTelemetryEvent(
    eventName: string,
    properties?: { [key: string]: string } | undefined,
    measurements?: { [key: string]: number } | undefined
  ): void {
    this.writeToFile(eventName, { ...properties, ...measurements });
  }

  sendExceptionEvent(
    exceptionName: string,
    exceptionMessage: string,
    measurements?: { [key: string]: number } | undefined
  ): void {
    this.writeToFile(exceptionName, { exceptionMessage, ...measurements });
  }

  dispose(): Promise<void> {
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
  public writeToFile(
    command: string,
    data: {
      [key: string]: string | number;
    }
  ) {
    const timestamp = new Date().toISOString();
    appendFile(
      LOCAL_TELEMETRY_FILE as string,
      JSON.stringify({ timestamp, command, data }, null, 2) + ',',
      err => {
        if (err) throw err;
        console.log('Telemetry data appended to file!');
      }
    );
  }
}
