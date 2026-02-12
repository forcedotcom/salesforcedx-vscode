/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DiscoverTestsOptions, ToolingTestClass, TestDiscoveryResult, ToolingTestsPage } from './schemas';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import type * as Either from 'effect/Either';
import { AllServicesLayer } from '../services/extensionProvider';

/**
 * Discover Apex test classes and methods using the Tooling REST Test Discovery API.
 * Docs: https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/intro_rest_resources_testing_discovery.htm
 */
const minApiVersion = 65.0;

export const discoverTests = (options: DiscoverTestsOptions = {}) =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const connection = yield* api.services.ConnectionService.getConnection();

    const connectionApiVersion = parseFloat(connection.getApiVersion());
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
      const urlToFetch = nextUrl; // Capture for TypeScript narrowing

      const pageResult: Either.Either<ToolingTestsPage, Error> = yield* Effect.either(
        Effect.tryPromise({
          try: (): Promise<ToolingTestsPage> =>
            connection.request<ToolingTestsPage>({ method: 'GET', url: urlToFetch, headers: requestHeaders }),
          catch: (error): Error =>
            new Error(`Failed to fetch test discovery page: ${error instanceof Error ? error.message : String(error)}`)
        })
      );

      if (pageResult._tag === 'Left') {
        const error = pageResult.left;
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Check if it's a 431 error (Request Header Fields Too Large)
        if (errorMessage.includes('431') || errorMessage.includes('Request Header Fields Too Large')) {
          partialResult = true;
          break;
        }
        // For other errors, rethrow
        yield* Effect.fail(error);
      }

      if (pageResult._tag === 'Right') {
        const page: ToolingTestsPage = pageResult.right;
        if (page?.apexTestClasses?.length) {
          classes.push(...page.apexTestClasses);
        }
        nextUrl = page?.nextRecordsUrl ?? undefined;
      }
    }

    if (partialResult) {
      // Log warning about partial results
      yield* Effect.logWarning(
        `Test discovery stopped early due to URL length limits. Loaded ${classes.length} unique test classes. Some tests may not be visible.`
      );
    }

    return { classes } satisfies TestDiscoveryResult;
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
    ),
    Effect.provide(AllServicesLayer)
  );
