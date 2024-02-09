/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export class LogStreamConfig {
  public static logFilePath(): string {
    const vsCodeLogsPath = process.env['VSCODE_LOGS'] ?? '';
    return vsCodeLogsPath;
  }
  public static isEnabledFor(extensionName: string): boolean | '' {
    const vsCodeLogLevelTrace = process.env['VSCODE_LOG_LEVEL'] === 'trace';
    return !!(
      LogStreamConfig.logFilePath() &&
      extensionName &&
      vsCodeLogLevelTrace
    );
  }
}
