/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TelemetryReporter } from '@salesforce/vscode-service-provider';
import { isLocalLogging } from '../../telemetry/utils/devModeUtils';
import { AppInsights } from './appInsights';
import { LogStream } from './logStream';
import { LogStreamConfig } from './logStreamConfig';
import { TelemetryFile } from './telemetryFile';
import { TelemetryReporterConfig } from './telemetryReporterConfig';

export const determineReporters = (config: TelemetryReporterConfig) => {
  const { extName, version, aiKey, userId, reporterName, isDevMode } = config;
  const reporters: TelemetryReporter[] = [];

  if (isDevMode) {
    addDevModeReporter(reporters, extName);
  } else {
    addAppInsightsReporter(reporters, reporterName, version, aiKey, userId);
    addLogstreamReporter(reporters, extName);
  }
  return reporters;
};

const addDevModeReporter = (reporters: TelemetryReporter[], extName: string) => {
  if (isLocalLogging(extName)) {
    // The new TelemetryFile reporter is run in Dev mode, and only
    // requires the advanced setting to be set re: configuration.
    reporters.push(new TelemetryFile(extName));
  }
};

const addAppInsightsReporter = (
  reporters: TelemetryReporter[],
  reporterName: string,
  version: string,
  aiKey: string,
  userId: string
) => {
  console.log('adding AppInsights reporter.');
  reporters.push(new AppInsights(reporterName, version, aiKey, userId, true));
};

/*
 * Assuming this fs streaming is more efficient than the appendFile technique that
 * the new TelemetryFile reporter uses, I am keeping the logic in place for which
 * reporter is used when.  The original log stream functionality only worked under
 * the same conditions as the AppInsights capabilities, but with additional configuration.
 */
const addLogstreamReporter = (reporters: TelemetryReporter[], extName: string) => {
  if (LogStreamConfig.isEnabledFor(extName)) {
    reporters.push(new LogStream(extName, LogStreamConfig.logFilePath()));
  }
};
