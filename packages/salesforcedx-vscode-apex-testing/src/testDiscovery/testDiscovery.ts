/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DiscoverTestsOptions, ToolingTestClass, TestDiscoveryResult, ToolingTestsPage } from './schemas';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';

/**
 * Discover Apex test classes and methods using the Tooling REST Test Discovery API.
 * Docs: https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/intro_rest_resources_testing_discovery.htm
 */
const minApiVersion = 65.0;

export const discoverTests = (options: DiscoverTestsOptions = {}) =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;

    // api.withDefaultOrg loses its generic type in PromisifiedContract mapping, returning Promise<unknown>.
    // Use Effect.map with explicit typing to restore type safety.
    const result = yield* Effect.tryPromise(() =>
      api.withDefaultOrg(async org => {
        const connectionApiVersion = parseFloat(org.apiVersion);
        // Ensure we use an API version that supports the Test Discovery API (>= 65.0)
        const apiVersion = (
          Number.isFinite(connectionApiVersion) ? Math.max(connectionApiVersion, minApiVersion) : minApiVersion
        ).toFixed(1);
        const basePath = `/services/data/v${apiVersion}/tooling/tests`;
        const qp = new URLSearchParams();
        // Always show all methods (both consumers use this)
        qp.set('showAllMethods', 'true');
        if (options?.namespacePrefix) {
          qp.set('namespacePrefix', options.namespacePrefix);
        }
        const baseUrl = qp.toString() ? `${basePath}?${qp.toString()}` : basePath;

        const classes: ToolingTestClass[] = [];
        let nextUrl: string | undefined = baseUrl;
        let partialResult = false;

        // Request headers to fix pagination URL format
        const requestHeaders = {
          'X-Chatter-Entity-Encoding': 'false'
        };

        while (nextUrl) {
          const urlToFetch: string = nextUrl; // Capture for TypeScript narrowing

          try {
            const page: ToolingTestsPage = await org.request<ToolingTestsPage>({
              method: 'GET',
              url: urlToFetch,
              headers: requestHeaders
            });
            if (page?.apexTestClasses?.length) {
              classes.push(...page.apexTestClasses);
            }
            nextUrl = page?.nextRecordsUrl ?? undefined;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Check if it's a 431 error (Request Header Fields Too Large)
            if (errorMessage.includes('431') || errorMessage.includes('Request Header Fields Too Large')) {
              partialResult = true;
              break;
            }
            // For other errors, rethrow
            throw error;
          }
        }

        if (partialResult) {
          // Log warning about partial results - using console since we're in plain Promise context
          console.warn(
            `Test discovery stopped early due to URL length limits. Loaded ${classes.length} unique test classes. Some tests may not be visible.`
          );
        }

        return { classes } satisfies TestDiscoveryResult;
      })
    ).pipe(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      Effect.map(r => r as TestDiscoveryResult)
    );
    return result;
  }).pipe(
    Effect.withSpan('apex-test-discovery', {
      attributes: {
        namespacePrefix: options?.namespacePrefix ?? 'all'
      }
    }),
    Effect.tap(result =>
      Effect.log(
        `Discovered ${result.classes.length} test classes with ${result.classes.reduce((acc, c) => acc + (c.testMethods?.length ?? 0), 0)} total methods`
      )
    )
  );
