/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ToolingTestClass, TestDiscoveryResult, ToolingTestsPage } from './schemas';
import type { Connection } from '@salesforce/core';
import { getVscodeCoreExtension } from '../coreExtensionUtils';
import { getTelemetryService } from '../telemetry/telemetry';

/**
 * Service that retrieves Apex test classes and methods from the Tooling REST Test Discovery API.
 * Docs: https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/intro_rest_resources_testing_discovery.htm
 */
export class TestDiscoveryService {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public static async create(): Promise<TestDiscoveryService | undefined> {
    try {
      const core = await getVscodeCoreExtension();
      const connection = await core.exports.services.WorkspaceContext.getInstance().getConnection();
      return new TestDiscoveryService(connection);
    } catch {
      // No default org or unable to establish a connection
      return undefined;
    }
  }

  public async discover(): Promise<TestDiscoveryResult> {
    const telemetry = getTelemetryService();
    const startTime = Date.now();
    telemetry.sendEventData('apexTestDiscoveryStart', {
      apiVersion: this.connection.getApiVersion()
    });

    try {
      const apiVersion = this.connection.getApiVersion();
      const baseUrl = `${this.connection.instanceUrl}/services/data/v${apiVersion}/tooling/tests`;

      const classes: ToolingTestClass[] = [];

      // paginate until no nextRecordsUrl
      let nextUrl: string | undefined = baseUrl;
      while (nextUrl) {
        let page: ToolingTestsPage | undefined;
        try {
          page = await this.connection.request<ToolingTestsPage>({ method: 'GET', url: nextUrl });
        } catch {
          page = undefined;
        }
        if (page?.apexTestClasses?.length) {
          classes.push(...page.apexTestClasses);
        }
        nextUrl = page?.nextRecordsUrl ? `${this.connection.instanceUrl}${page.nextRecordsUrl}` : undefined;
      }

      const durationMs = Date.now() - startTime;
      telemetry.sendEventData(
        'apexTestDiscoveryEnd',
        {
          apiVersion: this.connection.getApiVersion()
        },
        {
          durationMs,
          numClasses: classes.length,
          numMethods: classes.reduce((acc, c) => acc + (c.testMethods?.length ?? 0), 0)
        }
      );

      return {
        classes
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';
      telemetry.sendEventData(
        'apexTestDiscoveryError',
        {
          apiVersion: this.connection.getApiVersion(),
          message
        },
        { durationMs }
      );
      // Gracefully degrade to empty result
      return { classes: [] };
    }
  }

  // no safeRequest helper needed; using typed connection.request<T>() directly above
}

/**
 * Convenience function for consumers that don't want to manage service lifecycle.
 * Returns empty result if no default org/connection is available.
 */
export const discoverApexTests = async (): Promise<TestDiscoveryResult> => {
  const service = await TestDiscoveryService.create();
  if (!service) {
    // Offline or no default org set
    return { classes: [] };
  }
  return service.discover();
};
