/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { appendFile } from 'fs';
import { LOCAL_TELEMETRY_FILE } from '../constants';

export class LocalTelemetryReporter {
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
      LOCAL_TELEMETRY_FILE,
      JSON.stringify({ timestamp, command, data }, null, 2) + ',',
      err => {
        if (err) throw err;
        console.log('Telemetry data appended to file!');
      }
    );
  }
}
