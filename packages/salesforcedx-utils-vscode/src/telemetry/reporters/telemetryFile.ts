/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'node:path';
import { Uri, workspace } from 'vscode';
import { getRootWorkspacePath } from '../..';
import { LOCAL_TELEMETRY_FILE } from '../../constants';
import { TelemetryReporter } from '../../types';

/**
 * Represents a telemetry file that logs telemetry events by appending to a local file.
 */
export class TelemetryFile implements TelemetryReporter {
  private fileUri: Uri;
  private buffer: string = '';

  constructor(extensionId: string) {
    this.fileUri = Uri.file(path.join(getRootWorkspacePath(), `${extensionId}-${LOCAL_TELEMETRY_FILE}`));
    console.log(
      `Local telemetry event logging enabled for: ${extensionId}. Telemetry events will be appended to the file at: ${
        this.fileUri.fsPath
      }.`
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

  public async dispose(): Promise<void> {
    try {
      console.log('dispose called on Local Telemetry Logger.');
      if (this.buffer) {
        await this.flushBuffer();
      }
    } catch (error) {
      console.error('Error disposing telemetry file:', error);
      throw error;
    }
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
    const content = `${JSON.stringify({ timestamp, command, data }, null, 2)},`;
    this.buffer += content;
    await this.flushBuffer();
  }

  private async flushBuffer(): Promise<void> {
    try {
      await workspace.fs.writeFile(this.fileUri, Buffer.from(this.buffer));
    } catch (error) {
      console.error('Failed to write telemetry log:', error);
    }
  }
}
