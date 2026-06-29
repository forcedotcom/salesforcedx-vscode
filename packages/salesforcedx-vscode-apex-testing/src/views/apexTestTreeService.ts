/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
import * as Schema from 'effect/Schema';
import type * as vscode from 'vscode';
import { nls } from '../messages';
import { toUserFriendlyApexTestError } from '../utils/apexTestErrorMapper';
import { notificationService } from '../utils/notificationHelpers';

/** Top-level discovery failure surfaced to the user. */
class DiscoveryError extends Schema.TaggedError<DiscoveryError>()('DiscoveryError', {
  message: Schema.String
}) {}

/**
 * Maps the tooling-query error re-thrown out of resolvePackage2Members (the call boundary inside
 * populateTestItemsFromOrg). NOT a remap of the package-private TrySubjectIdError, which is caught
 * inside resolvePackage2Members and never crosses the boundary.
 */
class PackageResolutionError extends Schema.TaggedError<PackageResolutionError>()('PackageResolutionError', {
  message: Schema.String
}) {}

/** retrieveAllSuites failure during suite population (current behavior: log + continue with no suites). */
class SuiteRetrievalError extends Schema.TaggedError<SuiteRetrievalError>()('SuiteRetrievalError', {
  message: Schema.String
}) {}

/** Restore-previous-results path failure (non-fatal: the tree is valid without restored results). */
class RestoreResultsError extends Schema.TaggedError<RestoreResultsError>()('RestoreResultsError', {
  message: Schema.String
}) {}

/** Union of declared discovery-path failures handled by the doDiscover catchTags boundary. */
type DiscoveryFailure = DiscoveryError | PackageResolutionError | SuiteRetrievalError | RestoreResultsError;

/**
 * Surface a discovery-path failure to the user: warning when the friendly message is the
 * partial-discovery warning, error otherwise. Mirrors the legacy doDiscoverTests catch.
 */
const notifyDiscoveryFailure = Effect.fn('ApexTestTreeService.notifyDiscoveryFailure')(function* (e: DiscoveryFailure) {
  const friendlyMessage = toUserFriendlyApexTestError(e);
  yield* Effect.sync(() => {
    if (friendlyMessage === nls.localize('apex_test_discovery_partial_warning')) {
      void notificationService.showWarningMessage(friendlyMessage);
    } else {
      void notificationService.showErrorMessage(friendlyMessage);
    }
  });
});

/**
 * ApexTestTreeService — owns the test-item tree Refs (suite/class/method maps, class-to-parent map)
 * plus the discovery/restore coordination flags. The shell ApexTestController holds vscode lifecycle
 * objects (controller, tags) and passes them to service methods as runtime params; the service holds
 * only the Refs that out-of-scope shell methods also read.
 *
 * SettingsService / FsService / ConnectionService etc. are reached ambiently via api.services; they are
 * NOT declared as hard Default dependencies (that would double-provision at runtime).
 */
export class ApexTestTreeService extends Effect.Service<ApexTestTreeService>()('ApexTestTreeService', {
  accessors: true,
  dependencies: [],
  effect: Effect.gen(function* () {
    const suiteItems = yield* Ref.make<Map<string, vscode.TestItem>>(new Map());
    const classItems = yield* Ref.make<Map<string, vscode.TestItem>>(new Map());
    const methodItems = yield* Ref.make<Map<string, vscode.TestItem>>(new Map());
    const classToParentItem = yield* Ref.make<Map<string, vscode.TestItem>>(new Map());
    const hasRestoredResults = yield* Ref.make(false);
    const isRestoringResults = yield* Ref.make(false);
    // Zero-arg single-shot dedup: first discover() creates+stores the Deferred, late callers await it.
    // Reset to None on completion (see discover, Phase 2). NOT cachedFunction (arg-keyed memoization).
    const inFlightDiscovery = yield* Ref.make<Option.Option<Deferred.Deferred<void, DiscoveryError>>>(Option.none());

    /** Read the current method-items map (async accessor for shell methods that can await). */
    const getMethodItems = Effect.fn('ApexTestTreeService.getMethodItems')(function* () {
      return yield* Ref.get(methodItems);
    });

    /** Read the current class-items map. */
    const getClassItems = Effect.fn('ApexTestTreeService.getClassItems')(function* () {
      return yield* Ref.get(classItems);
    });

    /** Read the current suite-items map. */
    const getSuiteItems = Effect.fn('ApexTestTreeService.getSuiteItems')(function* () {
      return yield* Ref.get(suiteItems);
    });

    /** Read the current class-to-parent map. */
    const getClassToParentItem = Effect.fn('ApexTestTreeService.getClassToParentItem')(function* () {
      return yield* Ref.get(classToParentItem);
    });

    /** Reset all tree Refs to empty maps (shell clearTestItems delegates the moved-map clears here). */
    const reset = Effect.fn('ApexTestTreeService.reset')(function* () {
      yield* Ref.set(suiteItems, new Map());
      yield* Ref.set(classItems, new Map());
      yield* Ref.set(methodItems, new Map());
      yield* Ref.set(classToParentItem, new Map());
    });

    // Phase 1 stub: the discovery body lands in Phase 2 (reads the Refs above, resolves the org tree,
    // restores results). The handler shape is declared now so the four typed errors are wired into the
    // catchTags boundary from the start — no interim catchAll. The body currently resolves the services
    // api (the ambient handle Phase 2 builds on) and yields nothing.
    const discoverBody = Effect.fn('ApexTestTreeService.discoverBody')(function* () {
      yield* (yield* ExtensionProviderService).getServicesApi;
      // typed-error channel placeholder: Phase 2 replaces this with the real discovery pipeline whose
      // tryPromise boundaries fail with these tags. Empty here so no failure is raised yet.
      const failures: DiscoveryFailure[] = [];
      yield* Effect.forEach(failures, Effect.fail);
    });
    const doDiscover = Effect.fn('ApexTestTreeService.doDiscover')(function* () {
      yield* discoverBody().pipe(
        Effect.catchTags({
          DiscoveryError: notifyDiscoveryFailure,
          PackageResolutionError: notifyDiscoveryFailure,
          SuiteRetrievalError: notifyDiscoveryFailure,
          RestoreResultsError: notifyDiscoveryFailure
        })
      );
    });

    return {
      suiteItems,
      classItems,
      methodItems,
      classToParentItem,
      hasRestoredResults,
      isRestoringResults,
      inFlightDiscovery,
      getMethodItems,
      getClassItems,
      getSuiteItems,
      getClassToParentItem,
      reset,
      doDiscover
    };
  })
}) {}
