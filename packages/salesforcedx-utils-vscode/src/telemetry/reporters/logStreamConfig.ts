/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/**
 * Represents the configuration for a logging stream that is written to a local file.
 */
export class LogStreamConfig {
  /**
   * Retrieves the log file path.
   * @returns The log file path.
   */
  public static logFilePath(): string {
    const vsCodeLogsPath = process.env['VSCODE_LOGS'] ?? '';
    return vsCodeLogsPath;
  }

  /**
   * Checks if local stream logging is enabled for the specified extension.
   * @param extensionName - The name of the extension.
   * @returns True if logging is enabled, false otherwise.
   */
  public static isEnabledFor(extensionName: string): boolean | '' {
    const vsCodeLogLevelTrace = process.env['VSCODE_LOG_LEVEL'] === 'trace';
    return !!(LogStreamConfig.logFilePath() && extensionName && vsCodeLogLevelTrace);
  }
}
