/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { isError, isNotUndefined, isUndefined } from 'effect/Predicate';
import * as Result from 'effect/Result';
import * as Schema from 'effect/Schema';
import { nls } from '../messages';
import { type DiscoverTestsOptions, type TestDiscoveryResult, ToolingTestClass } from './schemas';

export class TestDiscoveryFetchError extends Schema.TaggedError<TestDiscoveryFetchError>()('TestDiscoveryFetchError', {
  message: Schema.String
}) {}

const ToolingTestsPageSchema = Schema.Struct({
  apexTestClasses: Schema.Unknown.pipe(Schema.Array, Schema.optional),
  nextRecordsUrl: Schema.String.pipe(Schema.NullOr, Schema.optional)
});

/**
 * Discover Apex test classes and methods using the Tooling REST Test Discovery API.
 * Docs: https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/intro_rest_resources_testing_discovery.htm
 */
const minApiVersion = 65.0;
const testLevelMinApiVersion = 68.0;

export const discoverTests = (options: DiscoverTestsOptions = {}) =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const connection = yield* api.v2.services.ConnectionService.use(service => service.getConnection());

    const connectionApiVersion = parseFloat(connection.getApiVersion());
    // Ensure we use an API version that supports the Test Discovery API (>= 65.0)
    const effectiveApiVersion = Number.isFinite(connectionApiVersion)
      ? Math.max(connectionApiVersion, minApiVersion)
      : minApiVersion;
    const apiVersion = effectiveApiVersion.toFixed(1);
    const basePath = `/services/data/v${apiVersion}/tooling/tests`;
    const qp = new URLSearchParams();
    // v68.0+ rejects `showAllMethods`; `testLevel=RunAllTestsInOrg` is Core's replacement default that keeps private-class visibility.
    if (effectiveApiVersion >= testLevelMinApiVersion) {
      qp.set('testLevel', 'RunAllTestsInOrg');
    } else {
      qp.set('showAllMethods', 'true');
    }
    if (options?.namespacePrefix) {
      qp.set('namespacePrefix', options.namespacePrefix);
    }
    const baseUrl = qp.toString() ? `${basePath}?${qp.toString()}` : basePath;

    // Request headers to fix pagination URL format
    const requestHeaders = {
      'X-Chatter-Entity-Encoding': 'false'
    };

    // Paginate through the Test Discovery API, accumulating decoded classes. A 431 (header too large)
    // stops early with partialResult=true (mirrored by a single malformed record degrading to partial).
    const initialState: { classes: ToolingTestClass[]; nextUrl: string | undefined; partialResult: boolean } = {
      classes: [],
      nextUrl: baseUrl,
      partialResult: false
    };
    type DiscoveryState = typeof initialState;
    const fetchPage = Effect.fn('apexTestDiscovery.fetchPage')(function* (pageState: DiscoveryState) {
      const urlToFetch = pageState.nextUrl;
      if (isUndefined(urlToFetch)) return pageState;

      const pageResult = yield* Effect.result(
        Effect.tryPromise({
          try: (): Promise<unknown> =>
            connection.request<unknown>({ method: 'GET', url: urlToFetch, headers: requestHeaders }),
          catch: (error): TestDiscoveryFetchError =>
            new TestDiscoveryFetchError({
              message: nls.localize(
                'apex_test_discovery_fetch_failed_message',
                isError(error) ? error.message : String(error)
              )
            })
        })
      );

      if (Result.isFailure(pageResult)) {
        const errorMessage = pageResult.failure.message;
        // Check if it's a 431 error (Request Header Fields Too Large)
        if (errorMessage.includes('431') || errorMessage.includes('Request Header Fields Too Large')) {
          return { ...pageState, nextUrl: undefined, partialResult: true };
        }
        return yield* pageResult.failure;
      }

      const decodedPage = yield* Effect.result(Schema.decodeUnknownEffect(ToolingTestsPageSchema)(pageResult.success));
      if (Result.isFailure(decodedPage)) {
        return { ...pageState, nextUrl: undefined, partialResult: true };
      }
      const page = decodedPage.success;
      const apexTestClasses = page.apexTestClasses ?? [];
      if (apexTestClasses.length === 0) {
        return { ...pageState, nextUrl: page.nextRecordsUrl ?? undefined };
      }
      // Decode the wire `""` sentinel to Option.none() at the parse boundary. Decode per-record so a
      // single malformed record degrades to a partial result (mirroring the 431 path) instead of
      // aborting the entire discovery.
      const results = yield* Effect.forEach(apexTestClasses, record =>
        Effect.result(Schema.decodeUnknownEffect(ToolingTestClass)(record))
      );
      const failures = results.filter(Result.isFailure).map(result => result.failure);
      if (failures.length > 0) {
        yield* Effect.logWarning(
          `Skipped ${failures.length} malformed test discovery record(s): ${failures.map(e => e.message).join('; ')}`
        );
      }
      return {
        ...pageState,
        classes: [...pageState.classes, ...results.filter(Result.isSuccess).map(result => result.success)],
        nextUrl: page.nextRecordsUrl ?? undefined
      };
    });

    const fetchPages: (pageState: DiscoveryState) => Effect.Effect<DiscoveryState, TestDiscoveryFetchError> = Effect.fn(
      'apexTestDiscovery.fetchPages'
    )(function* (pageState: DiscoveryState) {
      const nextState = yield* fetchPage(pageState);
      return isNotUndefined(nextState.nextUrl) ? yield* fetchPages(nextState) : nextState;
    });
    const state = yield* fetchPages(initialState);
    const { classes, partialResult } = state;

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
    )
  );
