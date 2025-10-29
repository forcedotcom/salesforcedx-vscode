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

  if (isDevMode) {
    return isLocalLogging(extName) ? [new TelemetryFile(extName)] : [];
  }
  return [
    ...getO11yReporter(extName),
    ...getAppInsightsReporter(reporterName, version, aiKey, userId, webUserId),
    ...getLogStreamReporter(extName)
  ];
};

const getAppInsightsReporter = (
  reporterName: string,
  version: string,
  aiKey: string,
  userId: string,
  webUserId: string
): TelemetryReporter[] => {
  console.log('adding AppInsights reporter.');
  return [new AppInsights(reporterName, version, aiKey, userId, webUserId, true)];
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

const getO11yReporter = (extName: string): TelemetryReporter[] => {
  if (o11yReporterInstances.has(extName)) {
    console.log('Added O11y reporter to reporters list');
    return [o11yReporterInstances.get(extName)!];
  }
  console.log('O11yReporter not initialized yet, skipping addition.');
  return [];
};

/*
 * Assuming this fs streaming is more efficient than the appendFile technique that
 * the new TelemetryFile reporter uses, I am keeping the logic in place for which
 * reporter is used when.  The original log stream functionality only worked under
 * the same conditions as the AppInsights capabilities, but with additional configuration.
 */
const getLogStreamReporter = (extName: string): TelemetryReporter[] =>
  LogStreamConfig.isEnabledFor(extName) ? [new LogStream(extName, LogStreamConfig.logFilePath())] : [];
