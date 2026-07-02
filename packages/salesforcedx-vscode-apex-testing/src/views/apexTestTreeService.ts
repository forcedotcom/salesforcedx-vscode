/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ToolingTestClass } from '../testDiscovery/schemas';
import type { Connection } from '@salesforce/core';
import { ExtensionProviderService, getMessageFromError } from '@salesforce/effect-ext-utils';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { RESULT_MAX_AGE_MS } from '../constants';
import { getDefaultOrgInfo } from '../coreExtensionUtils';
import { nls } from '../messages';
import * as settings from '../settings';
import { resolvePackage2Members } from '../testDiscovery/packageResolution';
import { discoverTests } from '../testDiscovery/testDiscovery';
import { toUserFriendlyApexTestError } from '../utils/apexTestErrorMapper';
import { getTestResultsFolder } from '../utils/pathHelpers';
import { sortByMtimeAscending } from '../utils/sortHelpers';
import { createNamespaceId, createSuiteId } from '../utils/testItemUtils';
import { buildClassToUriIndex } from '../utils/testUtils';
import { isFlowTest } from '../utils/toolingTestClassHelpers';
import {
  buildClassIdToNamespace,
  buildNamespacePackageStructure,
  createClassAndMethodsFactory,
  getNamespaceDisplayLabel,
  getPackageKeysOrdered,
  getPackageLabelAndId,
  isNonEmptyClassEntriesList,
  sortNamespaceKeys
} from './orgTestItems';

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

/**
 * Restore-previous-results path failure (non-fatal: the tree is valid without restored results).
 * `uri` carries the offending result file so a per-item apply/scan failure identifies which URI failed;
 * it is optional because pre-scan failures (e.g. no default org) have no file URI to attribute.
 */
class RestoreResultsError extends Schema.TaggedError<RestoreResultsError>()('RestoreResultsError', {
  uri: Schema.optional(Schema.String),
  message: Schema.String
}) {}

/**
 * Runtime data the shell passes into discovery methods: vscode lifecycle objects (controller, tags),
 * the lazily-initialized org connection/testService, and callbacks to shell-resident helpers that stay
 * out of scope for 4.1 (persist, result application, stale tagging). These are params (per-invocation
 * runtime data), not service dependencies.
 */
export type DiscoveryContext = {
  controller: vscode.TestController;
  suiteTag: vscode.TestTag | undefined;
  orgOnlyTag: vscode.TestTag | undefined;
  inWorkspaceTag: vscode.TestTag | undefined;
  sessionStartTime: number;
  ensureInitialized: () => Promise<void>;
  /** Full tree clear (controller.items + tree maps + shell-resident suiteToClasses), replicating the
   * legacy clearTestItems the discovery body ran at its start. */
  clearTree: () => void;
  getConnection: () => Connection;
  getTestService: () => { retrieveAllSuites: () => Promise<{ id: string; TestSuiteName: string }[]> };
  persistDiscoveredClasses: (classes: ToolingTestClass[]) => Promise<void>;
  updateTestResults: (uri: URI) => Promise<void>;
  applyStaleTags: (staleMethodIds?: Set<string>) => void;
  getMethodIdsFromResultFile: (uri: URI) => Promise<Set<string>>;
};

const BATCH_SIZE = 50;

/**
 * Surface a discovery-path failure to the user: warning when the friendly message is the
 * partial-discovery warning, error otherwise. Mirrors the legacy doDiscoverTests catch.
 */
const notifyDiscoveryFailure = Effect.fn('ApexTestTreeService.notifyDiscoveryFailure')(function* (
  e: DiscoveryError | PackageResolutionError
) {
  const friendlyMessage = toUserFriendlyApexTestError(e);
  yield* Effect.sync(
    () =>
      void (friendlyMessage === nls.localize('apex_test_discovery_partial_warning')
        ? vscode.window.showWarningMessage(friendlyMessage)
        : vscode.window.showErrorMessage(friendlyMessage))
  );
});

/**
 * ApexTestTreeService — owns the test-item tree Refs (suite/class/method maps, class-to-parent map)
 * plus the discovery/restore coordination flags. The shell ApexTestController holds vscode lifecycle
 * objects (controller, tags) and passes them to service methods via DiscoveryContext (runtime data); the
 * service holds only the Refs that out-of-scope shell methods also read.
 *
 * The Refs hold mutable Map objects: discovery helpers (createClassAndMethodsFactory) mutate the map
 * in place, and the Ref keeps pointing at the same object, so no per-entry write-back is needed. reset
 * clears the Maps in place (same object identity).
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
    // Reset to None on completion. NOT cachedFunction (arg-keyed memoization); must re-run next refresh.
    // doDiscover handles every discovery failure (notify) and cannot fail, so the Deferred carries no
    // error — late callers await completion, matching the legacy discoveryInProgress Promise (resolves
    // after the catch+notify, never rejects).
    const inFlightDiscovery = yield* Ref.make<Option.Option<Deferred.Deferred<void>>>(Option.none());

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

    /**
     * Clear all tree maps in place (shell clearTestItems delegates the moved-map clears here).
     * Clears in place rather than swapping in fresh Maps so any holder of the map reference (the shell,
     * during the 4.1→4.2 transition) keeps observing the same object.
     */
    const reset = Effect.fn('ApexTestTreeService.reset')(function* () {
      const maps = yield* Effect.all([
        Ref.get(suiteItems),
        Ref.get(classItems),
        Ref.get(methodItems),
        Ref.get(classToParentItem)
      ]);
      yield* Effect.sync(() => maps.forEach(map => map.clear()));
    });

    /**
     * Populate the "Apex Test Suites" parent node and its suite children from the org (Tooling API).
     * retrieveAllSuites failure is logged and recovered to "no suites" (the legacy behavior: log + return
     * early), so a suites outage never fails the whole discovery run.
     */
    const populateSuiteItems = Effect.fn('ApexTestTreeService.populateSuiteItems')(function* (ctx: DiscoveryContext) {
      yield* Effect.tryPromise({
        try: () => ctx.ensureInitialized(),
        catch: e => new DiscoveryError({ message: toUserFriendlyApexTestError(e) })
      });

      const suites = yield* Effect.tryPromise(() => ctx.getTestService().retrieveAllSuites()).pipe(
        Effect.catchAll(e =>
          Effect.logError('Error retrieving suites', { error: getMessageFromError(e) }).pipe(Effect.as([]))
        )
      );

      if (suites.length === 0) {
        return;
      }

      const currentSuiteItems = yield* Ref.get(suiteItems);
      yield* Effect.sync(() => {
        const suiteParentId = 'apex-test-suites-parent';
        const suiteParentItem = ctx.controller.createTestItem(
          suiteParentId,
          nls.localize('apex_test_suites_parent_text'),
          undefined
        );
        if (ctx.suiteTag) {
          suiteParentItem.tags = [ctx.suiteTag];
        }
        suites.forEach(suite => {
          const suiteId = createSuiteId(suite.TestSuiteName);
          const suiteItem = ctx.controller.createTestItem(suiteId, suite.TestSuiteName, undefined);
          suiteItem.canResolveChildren = true;
          if (ctx.suiteTag) {
            suiteItem.tags = [ctx.suiteTag];
          }
          currentSuiteItems.set(suite.TestSuiteName, suiteItem);
          suiteParentItem.children.add(suiteItem);
        });
        ctx.controller.items.add(suiteParentItem);
      });
    });

    /**
     * Build the org test tree (Namespace → Package → Class → Method) from Tooling API classes.
     * The resolvePackage2Members boundary maps its re-thrown tooling-query error to PackageResolutionError.
     * Yields cooperatively every BATCH_SIZE classes (Effect.yieldNow) so a large org tree doesn't block.
     */
    const populateTestItemsFromOrg = Effect.fn('ApexTestTreeService.populateTestItemsFromOrg')(function* (
      ctx: DiscoveryContext,
      classes: ToolingTestClass[]
    ) {
      const apexClasses = classes.filter(cls => cls.testMethods?.length > 0 && !isFlowTest(cls));
      if (apexClasses.length === 0) {
        return;
      }

      const classNameToUri = yield* Effect.tryPromise({
        try: () => buildClassToUriIndex(apexClasses.map(cls => cls.name)),
        catch: e => new DiscoveryError({ message: toUserFriendlyApexTestError(e) })
      });

      const classIds = apexClasses
        .map(cls => cls.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
      const [connection, orgInfo] = yield* Effect.all(
        [
          Effect.try({
            try: () => ctx.getConnection(),
            catch: e => new DiscoveryError({ message: toUserFriendlyApexTestError(e) })
          }),
          Effect.tryPromise({
            try: () => getDefaultOrgInfo(),
            catch: e => new DiscoveryError({ message: toUserFriendlyApexTestError(e) })
          })
        ],
        { concurrency: 'unbounded' }
      );
      // No default org → no org-scoped tree to build.
      if (!orgInfo.orgId) return;
      const orgKey = orgInfo.orgId;
      const classIdToPackage = yield* Effect.tryPromise({
        try: () => resolvePackage2Members(connection, classIds, buildClassIdToNamespace(apexClasses), orgInfo),
        catch: e => new PackageResolutionError({ message: getMessageFromError(e) })
      });

      const structure = buildNamespacePackageStructure(apexClasses, classIdToPackage);
      const currentClassItems = yield* Ref.get(classItems);
      const currentMethodItems = yield* Ref.get(methodItems);
      const currentClassToParent = yield* Ref.get(classToParentItem);
      const createClassAndMethods = createClassAndMethodsFactory({
        controller: ctx.controller,
        classItems: currentClassItems,
        methodItems: currentMethodItems,
        classNameToUri,
        orgKey,
        orgOnlyTag: ctx.orgOnlyTag,
        inWorkspaceTag: ctx.inWorkspaceTag
      });

      // Create the namespace/package nodes (order-dependent) and collect a flat list of class-add ops.
      // Flattening lets the cooperative yield run off a single index (no mutable counter).
      const classOps = sortNamespaceKeys(structure).flatMap(nsKey => {
        const pkMap = structure.get(nsKey);
        if (!pkMap) {
          return [];
        }
        const namespaceItem = ctx.controller.createTestItem(
          createNamespaceId(nsKey),
          getNamespaceDisplayLabel(nsKey),
          undefined
        );
        const ops = getPackageKeysOrdered(nsKey, [...pkMap.keys()]).flatMap(pkgKey => {
          const classEntriesList = pkMap.get(pkgKey);
          if (!isNonEmptyClassEntriesList(classEntriesList)) {
            return [];
          }
          const { packageLabel, packageId } = getPackageLabelAndId(nsKey, pkgKey, classEntriesList, classIdToPackage);
          const packageItem = ctx.controller.createTestItem(packageId, packageLabel, undefined);
          namespaceItem.children.add(packageItem);
          return classEntriesList.map(({ fullClassName, entries }) => ({ packageItem, fullClassName, entries }));
        });
        ctx.controller.items.add(namespaceItem);
        return ops;
      });

      yield* Effect.forEach(classOps, ({ packageItem, fullClassName, entries }, index) =>
        Effect.sync(() => {
          packageItem.children.add(createClassAndMethods(fullClassName, entries));
          currentClassToParent.set(fullClassName, packageItem);
        }).pipe(Effect.zipRight((index + 1) % BATCH_SIZE === 0 ? Effect.yieldNow() : Effect.void))
      );
    });

    const restoreResultsBody = Effect.fn('ApexTestTreeService.restoreResultsBody')(function* (ctx: DiscoveryContext) {
      if (!settings.retrieveRestorePreviousResults()) {
        return;
      }

      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const resultDir = yield* getTestResultsFolder().pipe(
        // Pre-scan org-config failure: no result file to attribute, so uri is omitted (non-fatal).
        Effect.catchTag('NoDefaultOrgError', e => new RestoreResultsError({ message: e.message }))
      );
      const entries = yield* api.services.FsService.readDirectory(resultDir).pipe(
        Effect.catchTag(
          'FsServiceError',
          e => new RestoreResultsError({ uri: resultDir.toString(), message: getMessageFromError(e) })
        )
      );

      // Find all test-result JSON files. Filenames embed Salesforce test-run IDs, which are NOT
      // chronologically sortable, so we order by mtime below rather than by filename.
      const resultUris = entries.filter(
        uri =>
          uri.path.includes('test-result') && uri.path.endsWith('.json') && !uri.path.endsWith('-codecoverage.json')
      );

      // Filter to files within the age threshold and track which methods are pre-session. Per-file
      // (Effect.forEach) so a single unreadable file fails with its own RestoreResultsError context
      // rather than aborting the whole scan.
      const now = Date.now();
      const staleMethodIds = new Set<string>();
      const sessionMethodIds = new Set<string>();
      const scanned = yield* Effect.forEach(resultUris, uri =>
        api.services.FsService.stat(uri).pipe(
          Effect.catchTag(
            'FsServiceError',
            e => new RestoreResultsError({ uri: uri.toString(), message: getMessageFromError(e) })
          ),
          Effect.flatMap(stat =>
            now - stat.mtime > RESULT_MAX_AGE_MS
              ? Effect.succeed(Option.none<{ uri: URI; mtime: number }>())
              : Effect.tryPromise({
                  try: () => ctx.getMethodIdsFromResultFile(uri),
                  catch: e => new RestoreResultsError({ uri: uri.toString(), message: getMessageFromError(e) })
                }).pipe(
                  Effect.map(methodsInFile => {
                    const targetSet = stat.mtime < ctx.sessionStartTime ? staleMethodIds : sessionMethodIds;
                    methodsInFile.forEach(methodId => targetSet.add(methodId));
                    return Option.some({ uri, mtime: stat.mtime });
                  })
                )
          )
        )
      );
      const recentResults = scanned.filter(Option.isSome).map(o => o.value);

      if (recentResults.length === 0) {
        return;
      }

      // Apply oldest-first (by mtime) so the most recent run's result wins for each method.
      const sortedRecent = sortByMtimeAscending(recentResults);
      const recentUris = sortedRecent.map(item => item.uri);

      // Session results override stale (a method run this session is not stale)
      sessionMethodIds.forEach(methodId => staleMethodIds.delete(methodId));

      // Apply oldest-first so most recent result for each method wins. Per-item tryPromise so a failing
      // URI surfaces in its own RestoreResultsError (not bucketed); concurrency:1 preserves oldest-first.
      yield* Effect.forEach(
        recentUris,
        uri =>
          Effect.tryPromise({
            try: () => ctx.updateTestResults(uri),
            catch: e => new RestoreResultsError({ uri: uri.toString(), message: getMessageFromError(e) })
          }),
        { concurrency: 1 }
      );

      // Only mark pre-session methods as stale
      yield* Effect.sync(() => ctx.applyStaleTags(staleMethodIds));

      // Invalidate stale methods and classes where ALL methods are stale
      const currentMethodItems = yield* Ref.get(methodItems);
      const currentClassItems = yield* Ref.get(classItems);
      yield* Effect.sync(() => {
        const affectedClasses = new Set<string>();
        staleMethodIds.forEach(methodId => {
          const methodItem = currentMethodItems.get(methodId);
          if (methodItem) {
            ctx.controller.invalidateTestResults(methodItem);
            affectedClasses.add(methodId.split('.')[0]);
          }
        });
        affectedClasses.forEach(className => {
          const classPrefix = `${className}.`;
          const allMethodsStale = [...currentMethodItems.entries()]
            .filter(([id]) => id.startsWith(classPrefix))
            .every(([id]) => staleMethodIds.has(id));
          if (allMethodsStale) {
            const classItem = currentClassItems.get(className);
            if (classItem) {
              ctx.controller.invalidateTestResults(classItem);
            }
          }
        });
      });

      // Most recent result's mtime (notification only); reuse the scan's mtime, no extra FsService.stat.
      const runDate = new Date(sortedRecent.at(-1)!.mtime).toLocaleString();
      const disableAction = nls.localize('apex_test_results_restored_disable_action');
      const selection = yield* Effect.promise(() =>
        vscode.window.showInformationMessage(
          nls.localize('apex_test_results_restored_message', recentUris.length, runDate),
          disableAction
        )
      );
      if (selection === disableAction) {
        yield* Effect.promise(() => settings.disableRestorePreviousResults());
      }
    });

    /**
     * Restore previous test results from on-disk result files (oldest-first so the newest run wins per
     * method), tag pre-session methods stale, and notify. test-and-set on isRestoringResults guards
     * against concurrent restores; the flag is reset in ensuring. Any failure is mapped to
     * RestoreResultsError and recovered (logWarning), since a failed restore leaves a valid empty tree.
     */
    const restorePreviousResults = Effect.fn('ApexTestTreeService.restorePreviousResults')(function* (
      ctx: DiscoveryContext
    ) {
      const proceed = yield* Ref.modify(isRestoringResults, prev => (prev ? [false, prev] : [true, true]));
      if (!proceed) {
        return;
      }

      yield* restoreResultsBody(ctx).pipe(
        // Restore is non-fatal: any failure (RestoreResultsError, or a services/workspace lookup failure)
        // leaves a valid empty tree, so recover all of them with a warning.
        Effect.catchAll(e =>
          Effect.logWarning('Failed to restore previous test results', getMessageFromError(e)).pipe(
            Effect.annotateLogs({ uri: e._tag === 'RestoreResultsError' ? e.uri : undefined })
          )
        ),
        Effect.ensuring(Ref.set(isRestoringResults, false))
      );
    });

    /**
     * Discovery pipeline body: ensure init, populate suites, run discovery, persist, build the org tree,
     * and restore results once per session. Each tryPromise boundary fails with a declared tagged error
     * (no UnknownException bucket). doDiscover catches the union and notifies.
     */
    const discoverBody = Effect.fn('ApexTestTreeService.discoverBody')(function* (ctx: DiscoveryContext) {
      yield* Effect.tryPromise({
        try: () => ctx.ensureInitialized(),
        catch: e => new DiscoveryError({ message: toUserFriendlyApexTestError(e) })
      });

      // Replicates the legacy clearTestItems the discovery body ran before populating.
      yield* Effect.sync(() => ctx.clearTree());

      yield* populateSuiteItems(ctx);

      const discoveryResult = yield* discoverTests().pipe(
        Effect.mapError(e => new DiscoveryError({ message: toUserFriendlyApexTestError(e) }))
      );

      yield* Effect.tryPromise({
        try: () => ctx.persistDiscoveredClasses(discoveryResult.classes),
        catch: e => new DiscoveryError({ message: toUserFriendlyApexTestError(e) })
      });

      if (discoveryResult.classes.length > 0) {
        yield* populateTestItemsFromOrg(ctx, discoveryResult.classes);
      }

      const alreadyRestored = yield* Ref.getAndSet(hasRestoredResults, true);
      if (!alreadyRestored) {
        yield* restorePreviousResults(ctx);
      }
    });

    /**
     * Run the discovery body and surface any declared failure to the user (warning vs error).
     * Only DiscoveryError and PackageResolutionError reach here: the retrieveAllSuites failure is recovered
     * inside populateSuiteItems (log + no suites) and RestoreResultsError inside restorePreviousResults
     * (logWarning), preserving the legacy non-fatal behavior of those two paths.
     */
    const doDiscover = Effect.fn('ApexTestTreeService.doDiscover')(function* (ctx: DiscoveryContext) {
      yield* discoverBody(ctx).pipe(
        Effect.catchTags({
          DiscoveryError: notifyDiscoveryFailure,
          PackageResolutionError: notifyDiscoveryFailure
        })
      );
    });

    /**
     * Single-shot dedup over doDiscover: the first caller creates+stores a Deferred and runs the body,
     * completing it and clearing the Ref in ensuring; concurrent callers await the same in-flight
     * Deferred. doDiscover handles all failures, so completion is success-only. Re-runs on the next
     * discover (not memoized).
     */
    const discover = Effect.fn('ApexTestTreeService.discover')(function* (ctx: DiscoveryContext) {
      const fresh = yield* Deferred.make<void>();
      // Atomic test-and-set: install the fresh Deferred only if none is in flight. winner === fresh
      // means this fiber leads; otherwise it observed an in-flight Deferred to await.
      const winner = yield* Ref.modify(inFlightDiscovery, prev =>
        Option.isSome(prev) ? [prev.value, prev] : [fresh, Option.some(fresh)]
      );
      if (winner !== fresh) {
        yield* Deferred.await(winner);
        return;
      }
      yield* doDiscover(ctx).pipe(
        Effect.ensuring(
          Deferred.succeed(fresh, undefined).pipe(Effect.zipRight(Ref.set(inFlightDiscovery, Option.none())))
        )
      );
      yield* Deferred.await(fresh);
    });

    /** Mark restored-results state cleared (shell refresh resets it before re-discovery). */
    const clearRestoredResults = Effect.fn('ApexTestTreeService.clearRestoredResults')(function* () {
      yield* Ref.set(hasRestoredResults, false);
    });

    return {
      // isRestoringResults is exposed only as a test seam for the test-and-set guard; the other Refs
      // and the discovery sub-steps (populateSuiteItems/populateTestItemsFromOrg) stay private so callers
      // cannot bypass discover()'s single-shot dedup or mutate tree state directly.
      isRestoringResults,
      getMethodItems,
      getClassItems,
      getSuiteItems,
      getClassToParentItem,
      reset,
      clearRestoredResults,
      restorePreviousResults,
      discover
    };
  })
}) {}
