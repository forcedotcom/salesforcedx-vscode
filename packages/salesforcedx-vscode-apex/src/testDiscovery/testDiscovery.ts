/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ToolingTestClass, TestDiscoveryResult, ToolingTestsPage } from './schemas';
import { getVscodeCoreExtension } from '../coreExtensionUtils';
import { nls } from '../messages';
import { getTelemetryService } from '../telemetry/telemetry';

/**
 * Discover Apex test classes and methods using the Tooling REST Test Discovery API.
 * Docs: https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/intro_rest_resources_testing_discovery.htm
 */

const minApiVersion = 65.0;

export type DiscoverTestsOptions = {
  showAllMethods?: boolean;
  namespacePrefix?: string;
  pageSize?: number;
};

export const discoverTests = async (
  options: DiscoverTestsOptions = { showAllMethods: true }
): Promise<TestDiscoveryResult> => {
  let connection;
  try {
    const core = await getVscodeCoreExtension();
    connection = await core.exports.services.WorkspaceContext.getInstance().getConnection();
  } catch {
    throw new Error(nls.localize('error_no_connection_found_message'));
  }
  const connectionApiVersion = parseFloat(connection.getApiVersion());
  const telemetry = getTelemetryService();
  const startTime = Date.now();

  try {
    // Ensure we use an API version that supports the Test Discovery API (>= 65.0)
    const apiVersion = (
      Number.isFinite(connectionApiVersion) ? Math.max(connectionApiVersion, minApiVersion) : minApiVersion
    ).toFixed(1);
    const basePath = `/services/data/v${apiVersion}/tooling/tests`;
    const qp = new URLSearchParams();
    if (options?.showAllMethods !== undefined) {
      qp.set('showAllMethods', String(options.showAllMethods));
    } else {
      qp.set('showAllMethods', 'true');
    }
    if (options?.namespacePrefix) {
      qp.set('namespacePrefix', options.namespacePrefix);
    }
    if (options?.pageSize) {
      qp.set('pageSize', String(options.pageSize));
    }
    const baseUrl = qp.toString() ? `${basePath}?${qp.toString()}` : basePath;

    const classes: ToolingTestClass[] = [];
    let nextUrl: string | undefined = baseUrl;
    while (nextUrl) {
      let page: ToolingTestsPage | undefined;
      try {
        page = await connection.request<ToolingTestsPage>({ method: 'GET', url: nextUrl });
      } catch {
        page = undefined;
      }
      if (page?.apexTestClasses?.length) {
        classes.push(...page.apexTestClasses);
      }
      nextUrl = page?.nextRecordsUrl ?? undefined;
    }

    const durationMs = Date.now() - startTime;
    telemetry.sendEventData(
      'apexTestDiscoveryEnd',
      { apiVersion: connectionApiVersion.toString() },
      {
        durationMs,
        numClasses: classes.length,
        numMethods: classes.reduce((acc, c) => acc + (c.testMethods?.length ?? 0), 0)
      }
    );
    return { classes };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const message = error instanceof Error ? error.message : 'Unknown error';
    telemetry.sendEventData(
      'apexTestDiscoveryError',
      {
        apiVersion: connectionApiVersion.toString(),
        errorMessage: message
      },
      { durationMs }
    );
    return { classes: [] };
  }
};
