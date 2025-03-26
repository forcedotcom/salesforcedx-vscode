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
import { O11yReporter } from './o11yReporter';
import { TelemetryFile } from './telemetryFile';
import { TelemetryReporterConfig } from './telemetryReporterConfig';

let o11yReporterInstance: O11yReporter | null = null;
let o11yInitializationPromise: Promise<void> | null = null;

export const setO11yInitializationPromise = (promise: Promise<void>) => {
  o11yInitializationPromise = promise;
};

export const getO11yInitializationPromise = (): Promise<void> | null => {
  return o11yInitializationPromise;
};

export const clearO11yInitializationPromise = () => {
  o11yInitializationPromise = null;
};

export const determineReporters = (config: TelemetryReporterConfig) => {
  const { extName, version, aiKey, userId, reporterName, isDevMode } = config;
  const reporters: TelemetryReporter[] = [];

  if (isDevMode) {
    addDevModeReporter(reporters, extName);
  } else {
    addO11yReporter(reporters, extName);
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

export const initializeO11yReporter = async (extName: string, o11yUploadEndpoint: string) => {
  if (o11yReporterInstance) return;

  if (getO11yInitializationPromise()) {
    await getO11yInitializationPromise();
    return;
  }

  o11yReporterInstance = new O11yReporter(extName, o11yUploadEndpoint);
  const initPromise = o11yReporterInstance
    .initialize(extName)
    .catch(err => {
      console.error('O11y initialization failed:', err);
      o11yReporterInstance = null;
    })
    .finally(() => clearO11yInitializationPromise());

  setO11yInitializationPromise(initPromise);
  await initPromise;
};

export const addO11yReporter = (reporters: TelemetryReporter[], extName: string): void => {
  if (o11yReporterInstance) {
    reporters.push(o11yReporterInstance);
    console.log('Added O11y reporter to reporters list');
  } else {
    console.log('O11yReporter not initialized yet, skipping addition.');
  }
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
