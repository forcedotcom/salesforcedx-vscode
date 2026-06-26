/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
import * as vscode from 'vscode';

/**
 * Caches the last test class and test method values to enable re-running without command context.
 * Ref-backed Effect state (replaces the former hand-rolled mutable singleton). Absence is modeled
 * as `Option.none` rather than an empty-string sentinel.
 */
export class ApexTestRunCacheService extends Effect.Service<ApexTestRunCacheService>()('ApexTestRunCacheService', {
  accessors: true,
  effect: Effect.gen(function* () {
    const lastClassTestParam = yield* Ref.make(Option.none<string>());
    const lastMethodTestParam = yield* Ref.make(Option.none<string>());

    const getLastClassTestParam = Effect.fn('ApexTestRunCacheService.getLastClassTestParam')(function* () {
      return yield* Ref.get(lastClassTestParam);
    });

    const getLastMethodTestParam = Effect.fn('ApexTestRunCacheService.getLastMethodTestParam')(function* () {
      return yield* Ref.get(lastMethodTestParam);
    });

    const setCachedClassTestParam = Effect.fn('ApexTestRunCacheService.setCachedClassTestParam')(function* (
      test: string
    ) {
      // enable then run 'last executed' command so command added to 'recently used'
      yield* Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:has_cached_test_class', true));
      yield* Ref.set(lastClassTestParam, Option.some(test));
    });

    const setCachedMethodTestParam = Effect.fn('ApexTestRunCacheService.setCachedMethodTestParam')(function* (
      test: string
    ) {
      // enable then run 'last executed' command so command added to 'recently used'
      yield* Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:has_cached_test_method', true));
      yield* Ref.set(lastMethodTestParam, Option.some(test));
    });

    return {
      getLastClassTestParam,
      getLastMethodTestParam,
      setCachedClassTestParam,
      setCachedMethodTestParam
    };
  })
}) {}
