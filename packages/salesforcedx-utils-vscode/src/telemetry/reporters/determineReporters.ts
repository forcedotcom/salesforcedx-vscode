/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { isLocalLogging } from '../../telemetry/utils/devModeUtils';
import { TelemetryReporter } from '../../types';
import { AppInsights } from './appInsights';
import { LogStream } from './logStream';
import { LogStreamConfig } from './logStreamConfig';
import { O11yReporter } from './o11yReporter';
import { TelemetryFile } from './telemetryFile';
import { TelemetryReporterConfig } from './telemetryReporterConfig';

const o11yReporterInstances: Map<string, O11yReporter> = new Map();
const o11yInitializationPromises: Map<string, Promise<void>> = new Map();

const setO11yInitializationPromise = (extName: string, promise: Promise<void>) => {
  o11yInitializationPromises.set(extName, promise);
};

const getO11yInitializationPromise = (extName: string): Promise<void> | null =>
  o11yInitializationPromises.get(extName) ?? null;

const clearO11yInitializationPromise = (extName: string) => {
  o11yInitializationPromises.delete(extName);
};

export const determineReporters = (config: TelemetryReporterConfig) => {
  const { extName, version, aiKey, userId, reporterName, isDevMode, webUserId } = config;
  const reporters: TelemetryReporter[] = [];

  if (isDevMode) {
    addDevModeReporter(reporters, extName);
  } else {
    addO11yReporter(reporters, extName);
    addAppInsightsReporter(reporters, reporterName, version, aiKey, userId, webUserId);
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
  userId: string,
  webUserId: string
) => {
  console.log('adding AppInsights reporter.');
  reporters.push(new AppInsights(reporterName, version, aiKey, userId, webUserId, true));
};

export const initializeO11yReporter = async (
  extName: string,
  o11yUploadEndpoint: string,
  userId: string,
  version: string,
  webUserId: string
): Promise<void> => {
  if (o11yReporterInstances.has(extName)) return;

  if (getO11yInitializationPromise(extName)) {
    await getO11yInitializationPromise(extName);
    return;
  }

  const o11yReporterInstance = new O11yReporter(extName, version, o11yUploadEndpoint, userId, webUserId);
  const initPromise = o11yReporterInstance
    .initialize(extName)
    .catch(err => {
      console.error('O11y initialization failed:', err);
      o11yReporterInstances.delete(extName);
    })
    .finally(() => clearO11yInitializationPromise(extName));

  o11yReporterInstances.set(extName, o11yReporterInstance);
  setO11yInitializationPromise(extName, initPromise);
  await initPromise;
};

const addO11yReporter = (reporters: TelemetryReporter[], extName: string): void => {
  if (o11yReporterInstances.has(extName)) {
    reporters.push(o11yReporterInstances.get(extName)!);
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
