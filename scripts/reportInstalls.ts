/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { promisify } from 'util';
import { exec } from 'child_process';
import * as appInsights from 'applicationinsights';
import { DEFAULT_AIKEY } from '../packages/salesforcedx-utils-vscode/src/constants';

const promisifiedExec = promisify(exec);

type InstallTelemetryData = {
  // To align with the properties property for appInsightsClient.trackEvent
  [key: string]: string;
  install: string;
  ratingcount: string;
  marketplace: string;
  'common.extname': string;
};

// These properties match the values provided in the statistics array from the
// vsce cli output
type InstallTelemetryDataMS = InstallTelemetryData & {
  averagerating: string;
  trendingdaily: string;
  trendingmonthly: string;
  trendingweekly: string;
  updateCount: string;
  weightedRating: string;
  downloadCount: string;
};

type TelemetryData = InstallTelemetryData | InstallTelemetryDataMS;

// Set to true for local development
const DRY_RUN = false;
const extensionsToTrack = [
  'salesforcedx-einstein-gpt',
  'salesforcedx-vscode-core',
  'salesforcedx-vscode-apex',
  'salesforcedx-vscode-apex-debugger',
  'salesforcedx-vscode-apex-replay-debugger',
  'salesforcedx-vscode-lightning',
  'salesforcedx-vscode-lwc',
  'salesforcedx-vscode-visualforce',
  'salesforcedx-vscode',
  'salesforcedx-vscode-expanded'
];
const eventName = 'installStats';
const marketPlaces = { MICROSOFT: 'MS', OPENVSX: 'OPENVSX' } as const;

const logger = (msg: string, obj?: any) => {
  if (!obj) {
    console.log(`*** ${msg}`);
  } else {
    console.log(`*** ${msg}`, JSON.stringify(obj, null, 2));
  }
};

// Lifted from https://github.com/forcedotcom/salesforcedx-vscode/blob/361a12dcdcb779cfd6aca844758361cf4947d0d1/packages/salesforcedx-utils-vscode/src/telemetry/telemetryReporter.ts#L83
const setupAppInsights = () => {
  appInsights
    .setup(DEFAULT_AIKEY)
    .setAutoCollectRequests(false)
    .setAutoCollectPerformance(false)
    .setAutoCollectExceptions(false)
    .setAutoCollectDependencies(false)
    .setAutoDependencyCorrelation(false)
    .setAutoCollectConsole(false)
    .setUseDiskRetryCaching(true)
    .start();
  return appInsights.defaultClient;
};

const appInsightsClient = setupAppInsights();

const reportInstallCount = (
  extensionIdentifier: string,
  extensionStats: TelemetryData
) => {
  const name = `${extensionIdentifier}/${eventName}`;
  logger(`Reporting install count for ${extensionIdentifier}`, {
    name,
    properties: extensionStats
  });

  if (!DRY_RUN) {
    appInsightsClient.trackEvent({
      name,
      properties: extensionStats
    });
  }
};

const reportVSCodeMarketplaceInstalls = async (extension: string) => {
  logger(`Reporting installs for ${extension}`);
  const command = `vsce show salesforce.${extension} --json`;
  const stats = await promisifiedExec(command);
  const jsonStats: { statistics: { statisticName: string; value: string }[] } =
    JSON.parse(stats.stdout);
  const extensionStats: InstallTelemetryDataMS = {
    install: '',
    averagerating: '',
    ratingcount: '',
    trendingdaily: '',
    trendingmonthly: '',
    trendingweekly: '',
    updateCount: '',
    weightedRating: '',
    downloadCount: '',
    marketplace: marketPlaces.MICROSOFT,
    'common.extname': extension
  };

  jsonStats.statistics.forEach(statObj => {
    extensionStats[statObj.statisticName] = String(statObj.value);
  });

  reportInstallCount(extension, extensionStats);
};

const reportOpenVSXInstalls = async (extension: string) => {
  const command = `ovsx get --metadata salesforce.${extension}`;
  const stats = await promisifiedExec(command);
  const jsonStats: { downloadCount: number; reviewCount: number } = JSON.parse(
    stats.stdout
  );
  const extensionStats: InstallTelemetryData = {
    install: String(jsonStats.downloadCount),
    ratingcount: String(jsonStats.reviewCount),
    marketplace: marketPlaces.OPENVSX,
    'common.extname': extension
  };

  reportInstallCount(extension, extensionStats);
};

const execute = async () => {
  logger('Report Installs Script Running...');

  for (const extension of extensionsToTrack) {
    try {
      logger('Report VSCode Marketplace Installs...');
      await reportVSCodeMarketplaceInstalls(extension);

      logger('Report OpenVSX Installs...');
      await reportOpenVSXInstalls(extension);
    } catch (err: unknown) {
      logger(`Error reporting installs for ${extension}`, err);
    }
  }
};

execute()
  .then(() => {
    return new Promise<void>(onFulfilled => {
      // ensure we report all the metrics
      appInsightsClient.flush({
        isAppCrashing: false,
        callback: () => {
          logger('AppInsights flush complete');
          onFulfilled();
        }
      });
    });
  })
  .then(() => {
    logger('reportInstalls script completed successfully');
    process.exit(0);
  })
  .catch(err => {
    logger('Error running reportInstalls script', err);
    process.exit(1);
  });
