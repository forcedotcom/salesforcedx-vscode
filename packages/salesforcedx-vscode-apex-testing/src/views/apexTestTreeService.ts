/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ToolingTestClass } from '../testDiscovery/schemas';
import { TestResult, TestService } from '@salesforce/apex-node';
import { ExtensionProviderService, getMessageFromError } from '@salesforce/effect-ext-utils';
import * as Array from 'effect/Array';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { APEX_TESTING_SECTION, RESULT_MAX_AGE_MS, TEST_ID_PREFIXES } from '../constants';
import { ApexTestDiscoveryService } from '../discoveryVfs/apexTestDiscoveryService';
import { nls } from '../messages';
import { PackageResolutionService } from '../testDiscovery/packageResolution';
import { discoverTests } from '../testDiscovery/testDiscovery';
import { toUserFriendlyApexTestError } from '../utils/apexTestErrorMapper';
import { getTestResultsFolder } from '../utils/pathHelpers';
import { sortByMtimeAscending } from '../utils/sortHelpers';
import {
  createMethodId,
  createNamespaceId,
  createSuiteClassId,
  createSuiteId,
  extractClassName,
  extractSuiteName,
  isClass,
  isMethod,
  isSuite
} from '../utils/testItemUtils';
import { buildClassToUriIndex, getMethodLocationsFromSymbols } from '../utils/testUtils';
import { getFullClassName, isFlowTest } from '../utils/toolingTestClassHelpers';
import {
  buildClassIdToNamespace,
  buildNamespacePackageStructure,
  createClassAndMethodsFactory,
  getNamespaceDisplayLabel,
  getPackageKeysOrdered,
  getPackageLabelAndId,
  isNonEmptyClassEntriesList,
  resolvePackageInfoForClassId,
  sortNamespaceKeys
} from './orgTestItems';

/** Top-level discovery failure surfaced to the user. */
class DiscoveryError extends Schema.TaggedError<DiscoveryError>()('DiscoveryError', {
  message: Schema.String
}) {}

/**
 * Maps a tooling-query rejection surfaced from resolvePackage2Members (the call boundary inside
 * populateTestItemsFromOrg). resolvePackage2Members queries Package2Member by documented columns
 * (SubjectId, SubjectKeyPrefix, SubscriberPackageId) and doesn't expose internal fallback logic.
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
 * Suite-children resolution failure surfaced to the user (carries the suite name + friendly message).
 * The connection failure arrives as a ConnectionService tagged error; the suite-query wrapping maps to
 * this so the vscode boundary can notify with the legacy apex_test_resolve_suite_children_failed_message.
 */
class ResolveSuiteChildrenError extends Schema.TaggedError<ResolveSuiteChildrenError>()('ResolveSuiteChildrenError', {
  suiteName: Schema.String,
  message: Schema.String
}) {}

/**
 * Per-invocation vscode objects the tree-mutation methods (incrementalUpdate / resolveSuiteChildren) need:
 * the controller and the four tags. Params (runtime data), not service dependencies.
 */
export type TreeMutationContext = {
  controller: vscode.TestController;
  orgOnlyTag: vscode.TestTag | undefined;
  inWorkspaceTag: vscode.TestTag | undefined;
  staleTag: vscode.TestTag | undefined;
};

/**
 * Runtime data the shell passes into discovery methods: vscode lifecycle objects (controller, tags) plus
 * two callbacks to shell-resident helpers (full tree clear + on-disk result application). These are params
 * (per-invocation runtime data), not service dependencies.
 */
export type DiscoveryContext = {
  controller: vscode.TestController;
  suiteTag: vscode.TestTag | undefined;
  orgOnlyTag: vscode.TestTag | undefined;
  inWorkspaceTag: vscode.TestTag | undefined;
  sessionStartTime: number;
  /** Full tree clear (controller.items + tree maps). */
  clearTree: () => void;
  /** Apply an on-disk result file to the live tree. Stays a callback (not a direct ApexTestExecutionService
   * call) because the execution service imports this tree service — a direct call would be a cycle. */
  updateTestResults: (uri: URI) => Promise<void>;
  staleTag: vscode.TestTag | undefined;
};

const BATCH_SIZE = 50;

const STALE = 'stale';
const isStale = (item: vscode.TestItem): boolean => !!item.tags?.some(t => t.id === STALE);

/** Find an existing child in a TestItemCollection matching the predicate. */
const findInCollection = (
  collection: vscode.TestItemCollection,
  predicate: (item: vscode.TestItem) => boolean
): vscode.TestItem | undefined => {
  const items: vscode.TestItem[] = [];
  collection.forEach(item => items.push(item));
  return items.find(predicate);
};
/** Find a child matching the predicate, or create one via `create`, add it to the collection, and return it. */
const findOrCreateChild = (
  collection: vscode.TestItemCollection,
  predicate: (item: vscode.TestItem) => boolean,
  create: () => vscode.TestItem
): vscode.TestItem => {
  const existing = findInCollection(collection, predicate);
  if (existing) {
    return existing;
  }
  const created = create();
  collection.add(created);
  return created;
};
/** Add the stale tag to an item if absent (idempotent). */
const addStaleTag = (item: vscode.TestItem, staleTag: vscode.TestTag): void => {
  const existingTags = item.tags ?? [];
  if (!existingTags.some(t => t.id === STALE)) {
    item.tags = [...existingTags, staleTag];
  }
};
const removeStaleTag = (item: vscode.TestItem): void => {
  item.tags = (item.tags ?? []).filter(t => t.id !== STALE);
};
/** A class owns a stale method when any method whose id is prefixed by `class.` is stale. */
const classHasStaleMethod = (methodItems: Map<string, vscode.TestItem>, className: string): boolean =>
  [...methodItems.entries()].some(([id, item]) => id.startsWith(`${className}.`) && isStale(item));
/** A suite owns a stale class when any of its member classes is stale. */
const suiteHasStaleClass = (classItems: Map<string, vscode.TestItem>, classNames: Set<string>): boolean =>
  [...classNames].some(cn => {
    const classItem = classItems.get(cn);
    return classItem ? isStale(classItem) : false;
  });

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
 * Read the current default org info ({ orgId, username }) inline from the Services TargetOrgRef.
 * Mirrors pathHelpers.getTestResultsFolder; avoids a file read for cache keys.
 */
const getDefaultOrgInfo = Effect.fn('ApexTestTreeService.getDefaultOrgInfo')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());
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
    // 9th shared-state Ref: suite name → member class full names. Written by resolveSuiteChildren, read by
    // stale-tag propagation + the execution service's suite expansion. Was a shell Map field pre-WI-5.
    const suiteToClasses = yield* Ref.make<Map<string, Set<string>>>(new Map());
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

    /** Read the current suite→classes map (member class full names per suite). */
    const getSuiteToClasses = Effect.fn('ApexTestTreeService.getSuiteToClasses')(function* () {
      return yield* Ref.get(suiteToClasses);
    });

    /** Record the member class full names for a single suite (resolveSuiteChildren writer). */
    const setSuiteClasses = Effect.fn('ApexTestTreeService.setSuiteClasses')(function* (
      suiteName: string,
      classNames: Set<string>
    ) {
      yield* Ref.update(suiteToClasses, map => map.set(suiteName, classNames));
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
        Ref.get(classToParentItem),
        Ref.get(suiteToClasses)
      ]);
      yield* Effect.sync(() => maps.forEach(map => map.clear()));
    });

    /**
     * Mark methods stale (all, or a given subset), then propagate the stale tag up to class and suite
     * items that own a stale descendant. Restore path (pre-session results) and the shell delegate here.
     */
    const markStaleTags = Effect.fn('ApexTestTreeService.markStaleTags')(function* (
      staleTag: vscode.TestTag | undefined,
      staleMethodIds?: Set<string>
    ) {
      if (!staleTag) {
        return;
      }
      const [currentMethods, currentClasses, currentSuites, currentSuiteToClasses] = yield* Effect.all([
        Ref.get(methodItems),
        Ref.get(classItems),
        Ref.get(suiteItems),
        Ref.get(suiteToClasses)
      ]);
      yield* Effect.sync(() => {
        currentMethods.forEach((methodItem, methodId) => {
          if (!staleMethodIds || staleMethodIds.has(methodId)) {
            addStaleTag(methodItem, staleTag);
          }
        });
        currentClasses.forEach((classItem, className) => {
          if (classHasStaleMethod(currentMethods, className)) {
            addStaleTag(classItem, staleTag);
          }
        });
        currentSuites.forEach((suiteItem, suiteName) => {
          const classNames = currentSuiteToClasses.get(suiteName);
          if (classNames && suiteHasStaleClass(currentClasses, classNames)) {
            addStaleTag(suiteItem, staleTag);
          }
        });
      });
    });

    /**
     * Inverse of markStaleTags: clear the stale tag from the methods that just ran (expanded from the
     * selected class/suite items), then clear it from parent class and suite items once none of their
     * members remain stale. Called after a run from the execution service.
     */
    const clearStaleTags = Effect.fn('ApexTestTreeService.clearStaleTags')(function* (testsToRun: vscode.TestItem[]) {
      const [currentMethods, currentClasses, currentSuites, currentSuiteToClasses] = yield* Effect.all([
        Ref.get(methodItems),
        Ref.get(classItems),
        Ref.get(suiteItems),
        Ref.get(suiteToClasses)
      ]);
      // Method map keys omit the method: prefix; expand each selection to its member method ids.
      const methodIdsForClass = (className: string): string[] =>
        [...currentMethods.keys()].filter(id => id.startsWith(`${className}.`));
      const classNamesForTest = (test: vscode.TestItem): string[] =>
        isClass(test.id)
          ? [extractClassName(test.id)].filter((cn): cn is string => !!cn)
          : isSuite(test.id)
            ? [...(currentSuiteToClasses.get(extractSuiteName(test.id) ?? '') ?? [])]
            : [];
      const methodIdsForTest = (test: vscode.TestItem): string[] =>
        isMethod(test.id)
          ? [test.id.replace(TEST_ID_PREFIXES.METHOD, '')]
          : classNamesForTest(test).flatMap(methodIdsForClass);

      const runMethodIds = HashSet.fromIterable(testsToRun.flatMap(methodIdsForTest));
      // Classes touched by a run method that actually exists in the tree (its parent's stale tag may clear).
      const affectedClasses = HashSet.fromIterable(
        HashSet.toValues(runMethodIds)
          .filter(id => currentMethods.has(id))
          .map(id => id.split('.')[0])
      );

      yield* Effect.sync(() => {
        // Clear stale tags from methods that ran.
        HashSet.forEach(runMethodIds, methodId => {
          const methodItem = currentMethods.get(methodId);
          if (methodItem) {
            removeStaleTag(methodItem);
          }
        });
        // Clear the stale tag from parent classes once no member method remains stale.
        HashSet.forEach(affectedClasses, className => {
          const classItem = currentClasses.get(className);
          if (classItem && !classHasStaleMethod(currentMethods, className)) {
            removeStaleTag(classItem);
          }
        });
        // Clear the stale tag from suites once no member class remains stale.
        currentSuites.forEach((suiteItem, suiteName) => {
          const classNames = currentSuiteToClasses.get(suiteName);
          if (classNames && !suiteHasStaleClass(currentClasses, classNames)) {
            removeStaleTag(suiteItem);
          }
        });
      });
    });

    /**
     * Parse an on-disk test-result JSON file into the set of `Class.method` ids it contains. Read failures
     * (missing/unparseable file) resolve to an empty set — a best-effort scan for the restore path.
     */
    const getMethodIdsFromResultFile = Effect.fn('ApexTestTreeService.getMethodIdsFromResultFile')(function* (
      testResultUri: URI
    ) {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const methodIds = new Set<string>();
      const resultText = yield* api.services.FsService.readFile(testResultUri).pipe(
        Effect.catchTag('FsServiceError', () => Effect.void)
      );
      if (resultText === undefined) {
        return methodIds;
      }
      // Recover a corrupt/truncated file to "no ids" (matches the doc + legacy try/catch) so a bad file
      // never becomes an uncaught defect that aborts the restore path.
      const resultContent = yield* Effect.try(
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        () => JSON.parse(resultText) as TestResult
      ).pipe(Effect.orElseSucceed(() => undefined));
      if (resultContent === undefined) {
        return methodIds;
      }
      (resultContent.tests ?? []).forEach(test => {
        const className = test.apexClass?.fullName;
        const methodName = test.methodName;
        if (className && methodName) {
          methodIds.add(`${className}.${methodName}`);
        }
      });
      return methodIds;
    });

    /**
     * Populate the "Apex Test Suites" parent node and its suite children from the org (Tooling API).
     * retrieveAllSuites failure is logged and recovered to "no suites" (the legacy behavior: log + return
     * early), so a suites outage never fails the whole discovery run.
     */
    const populateSuiteItems = Effect.fn('ApexTestTreeService.populateSuiteItems')(function* (ctx: DiscoveryContext) {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const connection = yield* api.services.ConnectionService.getConnection().pipe(
        Effect.mapError(e => new DiscoveryError({ message: toUserFriendlyApexTestError(e) }))
      );

      const suites = yield* Effect.tryPromise(() => new TestService(connection).retrieveAllSuites()).pipe(
        Effect.catchTag('UnknownException', e =>
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
     * The resolvePackage2Members boundary maps any rejection to PackageResolutionError.
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

      const orgInfo = yield* getDefaultOrgInfo().pipe(
        Effect.mapError(e => new DiscoveryError({ message: toUserFriendlyApexTestError(e) }))
      );
      // No default org → no org-scoped tree to build.
      if (!orgInfo.orgId) return;
      const orgKey = orgInfo.orgId;
      const classIdToPackage = yield* PackageResolutionService.resolve(
        Array.getSomes(apexClasses.map(cls => cls.id)),
        buildClassIdToNamespace(apexClasses)
      ).pipe(Effect.mapError(e => new PackageResolutionError({ message: getMessageFromError(e) })));

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

    /**
     * Query the Tooling API for the source body of each discovered class (chunked, IN-clause), keyed by full
     * class name. Missing bodies fall back to a localized placeholder so the VFS snapshot always has an entry.
     */
    const fetchClassBodiesByFullName = Effect.fn('ApexTestTreeService.fetchClassBodiesByFullName')(function* (
      classes: ToolingTestClass[]
    ) {
      const classIds = Array.getSomes(classes.map(cls => cls.id)).toSorted();
      const bodyByFullName = new Map<string, string>();
      if (classIds.length === 0) {
        return bodyByFullName;
      }

      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const connection = yield* api.services.ConnectionService.getConnection();
      const chunkSize = 200;
      yield* Effect.forEach(
        Array.chunksOf(classIds, chunkSize),
        chunkIds =>
          Effect.gen(function* () {
            const inClause = chunkIds.map(id => `'${id.replaceAll("'", "''")}'`).join(',');
            const query = `SELECT Id, Name, NamespacePrefix, Body FROM ApexClass WHERE Id IN (${inClause})`;
            const queryResult = yield* Effect.promise(() =>
              connection.tooling.query<{ Name: string; NamespacePrefix?: string | null; Body?: string | null }>(query)
            );
            queryResult.records.forEach(record => {
              const fullClassName = record.NamespacePrefix?.trim()
                ? `${record.NamespacePrefix}.${record.Name}`
                : record.Name;
              bodyByFullName.set(
                fullClassName,
                record.Body ?? nls.localize('apex_discovery_vfs_class_body_placeholder', fullClassName)
              );
            });
          }),
        { concurrency: 1 }
      );

      classes.forEach(cls => {
        const fullClassName = getFullClassName(cls);
        if (!bodyByFullName.has(fullClassName)) {
          bodyByFullName.set(fullClassName, nls.localize('apex_discovery_vfs_class_body_placeholder', fullClassName));
        }
      });
      return bodyByFullName;
    });

    const logPersistWarning = (error: unknown) =>
      Effect.logWarning('failed to persist discovered Apex classes', { error });

    /**
     * Persist the discovered classes to the org-keyed VFS snapshot (best-effort optimization). Org-info
     * lookup, body fetch, and the write are recovered on failure so persistence never fails the discovery run.
     */
    const persistDiscoveredClasses = Effect.fn('ApexTestTreeService.persistDiscoveredClasses')(function* (
      classes: ToolingTestClass[]
    ) {
      const apexClasses = classes.filter(cls => cls.testMethods?.length > 0 && !isFlowTest(cls));
      yield* Effect.gen(function* () {
        const { orgId } = yield* getDefaultOrgInfo();
        // No default org → nothing to key the snapshot by; persistence is best-effort, so skip.
        if (!orgId) return;
        const classBodiesByFullName = yield* fetchClassBodiesByFullName(apexClasses);
        yield* ApexTestDiscoveryService.saveDiscoveredClasses(orgId, apexClasses, classBodiesByFullName);
      }).pipe(
        Effect.catchTags({
          DiscoveryClearError: logPersistWarning,
          ServicesExtensionNotFoundError: logPersistWarning,
          InvalidServicesApiError: logPersistWarning
        })
      );
    });

    const restoreResultsBody = Effect.fn('ApexTestTreeService.restoreResultsBody')(function* (ctx: DiscoveryContext) {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const settings = yield* api.services.SettingsService;
      const restorePrevious =
        (yield* settings.getValue<boolean>(APEX_TESTING_SECTION, 'restore-previous-results', true)) ?? true;
      if (!restorePrevious) {
        return;
      }

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
              : getMethodIdsFromResultFile(uri).pipe(
                  Effect.mapError(
                    e => new RestoreResultsError({ uri: uri.toString(), message: getMessageFromError(e) })
                  ),
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
      yield* markStaleTags(ctx.staleTag, staleMethodIds);

      // Invalidate stale methods and classes where ALL methods are stale
      const currentMethodItems = yield* Ref.get(methodItems);
      const currentClassItems = yield* Ref.get(classItems);
      // Classes owning an invalidated stale method (dedup); invalidate those whose every method is stale.
      const affectedClasses = HashSet.fromIterable(
        [...staleMethodIds].filter(id => currentMethodItems.has(id)).map(id => id.split('.')[0])
      );
      yield* Effect.sync(() => {
        staleMethodIds.forEach(methodId => {
          const methodItem = currentMethodItems.get(methodId);
          if (methodItem) {
            ctx.controller.invalidateTestResults(methodItem);
          }
        });
        HashSet.forEach(affectedClasses, className => {
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
        // Preserve legacy behavior: write to Workspace target (not Global).
        yield* settings.setValue(
          APEX_TESTING_SECTION,
          'restore-previous-results',
          false,
          vscode.ConfigurationTarget.Workspace
        );
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
        // Restore is non-fatal: any failure (RestoreResultsError, or a services/workspace/settings lookup
        // failure) leaves a valid empty tree, so recover each tagged error with a warning. Only
        // RestoreResultsError carries the offending result-file uri.
        Effect.catchTags({
          RestoreResultsError: e =>
            Effect.logWarning('Failed to restore previous test results', getMessageFromError(e)).pipe(
              Effect.annotateLogs({ uri: e.uri })
            ),
          NoWorkspaceOpenError: e =>
            Effect.logWarning('Failed to restore previous test results', getMessageFromError(e)),
          ServicesExtensionNotFoundError: e =>
            Effect.logWarning('Failed to restore previous test results', getMessageFromError(e)),
          InvalidServicesApiError: e =>
            Effect.logWarning('Failed to restore previous test results', getMessageFromError(e)),
          MissingSettingsError: e =>
            Effect.logWarning('Failed to restore previous test results', getMessageFromError(e))
        }),
        Effect.ensuring(Ref.set(isRestoringResults, false))
      );
    });

    /**
     * Discovery pipeline body: ensure init, populate suites, run discovery, persist, build the org tree,
     * and restore results once per session. Each tryPromise boundary fails with a declared tagged error
     * (no UnknownException bucket). doDiscover catches the union and notifies.
     */
    const discoverBody = Effect.fn('ApexTestTreeService.discoverBody')(function* (ctx: DiscoveryContext) {
      // Acquire the connection up front (fail-fast, replacing the legacy ensureInitialized); the cached
      // ConnectionService reuses it for the populate* steps below.
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      yield* api.services.ConnectionService.getConnection().pipe(
        Effect.mapError(e => new DiscoveryError({ message: toUserFriendlyApexTestError(e) }))
      );

      // Replicates the legacy clearTestItems the discovery body ran before populating.
      yield* Effect.sync(() => ctx.clearTree());

      yield* populateSuiteItems(ctx);

      const discoveryResult = yield* discoverTests().pipe(
        Effect.mapError(e => new DiscoveryError({ message: toUserFriendlyApexTestError(e) }))
      );

      yield* persistDiscoveredClasses(discoveryResult.classes);

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

    // Walk up the tree removing empty package/namespace nodes. TestItems have no parent reference, so
    // search controller.items. Pure vscode mutation (no Ref reads); kept as a plain helper.
    const removeEmptyAncestors = (controller: vscode.TestController, item: vscode.TestItem): void => {
      controller.items.forEach(namespaceItem => {
        namespaceItem.children.forEach(packageItem => {
          if (packageItem.id === item.id && packageItem.children.size === 0) {
            namespaceItem.children.delete(packageItem.id);
          }
        });
        if (namespaceItem.children.size === 0) {
          controller.items.delete(namespaceItem.id);
        }
      });
    };

    /** Remove a class (and its methods) from the tree maps + its parent node, pruning empty ancestors. */
    const removeClassFromTree = Effect.fn('ApexTestTreeService.removeClassFromTree')(function* (
      ctx: TreeMutationContext,
      fullClassName: string
    ) {
      const [currentClassItems, currentMethodItems, currentClassToParent] = yield* Effect.all([
        Ref.get(classItems),
        Ref.get(methodItems),
        Ref.get(classToParentItem)
      ]);
      const classItem = currentClassItems.get(fullClassName);
      if (!classItem) {
        return;
      }
      yield* Effect.sync(() => {
        classItem.children.forEach(methodItem => {
          currentMethodItems.delete(methodItem.id);
        });
        const parentItem = currentClassToParent.get(fullClassName);
        if (parentItem) {
          parentItem.children.delete(classItem.id);
          if (parentItem.children.size === 0) {
            removeEmptyAncestors(ctx.controller, parentItem);
          }
        }
        currentClassItems.delete(fullClassName);
        currentClassToParent.delete(fullClassName);
      });
    });

    /** Add a newly-discovered class to the tree under its namespace/package, resolving package membership. */
    const addClassToTree = Effect.fn('ApexTestTreeService.addClassToTree')(function* (
      ctx: TreeMutationContext,
      cls: ToolingTestClass,
      classNameToUri: Map<string, URI>,
      orgKey: string
    ) {
      const classIds = Option.match(cls.id, { onNone: () => [], onSome: id => [id] });
      const classIdToPackage = yield* PackageResolutionService.resolve(classIds, buildClassIdToNamespace([cls])).pipe(
        Effect.mapError(e => new PackageResolutionError({ message: getMessageFromError(e) }))
      );

      const [currentClassItems, currentMethodItems, currentClassToParent] = yield* Effect.all([
        Ref.get(classItems),
        Ref.get(methodItems),
        Ref.get(classToParentItem)
      ]);
      const structure = buildNamespacePackageStructure([cls], classIdToPackage);
      const createClassAndMethods = createClassAndMethodsFactory({
        controller: ctx.controller,
        classItems: currentClassItems,
        methodItems: currentMethodItems,
        classNameToUri,
        orgKey,
        orgOnlyTag: ctx.orgOnlyTag,
        inWorkspaceTag: ctx.inWorkspaceTag
      });

      yield* Effect.sync(() => {
        structure.forEach((pkMap, nsKey) => {
          pkMap.forEach((classEntriesList, pkgKey) => {
            classEntriesList.forEach(({ fullClassName: fcn, entries }) => {
              const nsId = createNamespaceId(nsKey);
              const namespaceItem = findOrCreateChild(
                ctx.controller.items,
                item => item.id === nsId,
                () => ctx.controller.createTestItem(nsId, getNamespaceDisplayLabel(nsKey), undefined)
              );

              const classEntry = classEntriesList[0];
              const info = resolvePackageInfoForClassId(classEntry.entries[0].id, classIdToPackage);
              const packageLabel = info?.packageName ?? pkgKey;
              const pkgNodeId = `${nsKey}/${pkgKey}`;
              const packageItem = findOrCreateChild(
                namespaceItem.children,
                item => item.id === pkgNodeId || item.label === packageLabel,
                () => ctx.controller.createTestItem(pkgNodeId, packageLabel, undefined)
              );

              const classItem = createClassAndMethods(fcn, entries);
              packageItem.children.add(classItem);
              currentClassToParent.set(fcn, packageItem);
            });
          });
        });
      });
    });

    /** Diff an existing class's method items against a fresh discovery (add/remove/reorder + reposition). */
    const diffClassMethods = Effect.fn('ApexTestTreeService.diffClassMethods')(function* (
      ctx: TreeMutationContext,
      fullClassName: string,
      classItem: vscode.TestItem,
      discoveredClass: ToolingTestClass,
      classNameToUri: Map<string, URI>
    ) {
      // Tooling API is authoritative for which methods are test methods (@isTest)
      const discoveredMethodNames = new Set((discoveredClass.testMethods ?? []).map(m => m.name));

      const localUri = classNameToUri.get(discoveredClass.name);
      const uri = localUri ?? classItem.uri;
      const isOrgOnly = !localUri;

      // Use LSP for positions (accurate after deploy), fall back to Tooling API positions
      const methodPositions = new Map<string, { line: number; column: number }>();
      if (localUri) {
        const symbolLocations = yield* Effect.promise(() =>
          getMethodLocationsFromSymbols(localUri, [...discoveredMethodNames])
        );
        if (symbolLocations) {
          symbolLocations.forEach((location, name) => {
            methodPositions.set(name, { line: location.range.start.line, column: location.range.start.character });
          });
        }
      }
      const currentMethodItems = yield* Ref.get(methodItems);
      yield* Effect.sync(() => {
        (discoveredClass.testMethods ?? []).forEach(method => {
          if (!methodPositions.has(method.name)) {
            methodPositions.set(method.name, {
              line: Math.max(0, (method.line ?? 1) - 1),
              column: Math.max(0, (method.column ?? 1) - 1)
            });
          }
        });

        const existingMethodsByName = new Map<string, vscode.TestItem>();
        classItem.children.forEach(child => {
          if (isMethod(child.id)) {
            existingMethodsByName.set(child.label, child);
          }
        });

        // Remove methods no longer in discovery
        existingMethodsByName.forEach((methodItem, methodName) => {
          if (!discoveredMethodNames.has(methodName)) {
            currentMethodItems.delete(methodItem.id);
            existingMethodsByName.delete(methodName);
          }
        });

        // Sort method names by resolved position
        const sortedMethodNames = [...discoveredMethodNames].toSorted((a, b) => {
          const posA = methodPositions.get(a);
          const posB = methodPositions.get(b);
          return (posA?.line ?? 0) - (posB?.line ?? 0);
        });

        // Build ordered children list
        const orderedChildren = sortedMethodNames.map(methodName => {
          const existing = existingMethodsByName.get(methodName);
          if (existing) {
            const existingPos = methodPositions.get(methodName);
            if (existingPos) {
              const existingPosition = new vscode.Position(existingPos.line, existingPos.column);
              existing.range = new vscode.Range(existingPosition, existingPosition);
            }
            return existing;
          }
          const methodId = createMethodId(fullClassName, methodName);
          const pos = methodPositions.get(methodName) ?? { line: 0, column: 0 };
          const position = new vscode.Position(pos.line, pos.column);
          const range = new vscode.Range(position, position);
          const methodItem = ctx.controller.createTestItem(methodId, methodName, uri);
          methodItem.range = range;
          if (isOrgOnly && ctx.orgOnlyTag) {
            methodItem.tags = [ctx.orgOnlyTag];
          } else if (ctx.inWorkspaceTag) {
            methodItem.tags = [ctx.inWorkspaceTag];
          }
          currentMethodItems.set(methodId, methodItem);
          return methodItem;
        });

        // Replace all children in source order
        classItem.children.replace(orderedChildren);

        // Update class tags if workspace presence changed (URI is readonly on TestItem)
        if (localUri && ctx.inWorkspaceTag && !classItem.tags?.includes(ctx.inWorkspaceTag)) {
          classItem.tags = [ctx.inWorkspaceTag];
        }
      });
    });

    /** Apply the created/changed diff from a fresh discovery to the existing tree (add/diff/remove class). */
    const applyIncrementalDiff = Effect.fn('ApexTestTreeService.applyIncrementalDiff')(function* (
      ctx: TreeMutationContext,
      discoveredClasses: ToolingTestClass[],
      changes: Map<string, string>
    ) {
      const apexClasses = discoveredClasses.filter(cls => cls.testMethods?.length > 0 && !isFlowTest(cls));
      const discoveryMap = new Map(apexClasses.map(cls => [getFullClassName(cls), cls]));

      const classNameToUri = yield* Effect.promise(() => buildClassToUriIndex(apexClasses.map(cls => cls.name)));
      const { orgId } = yield* getDefaultOrgInfo();
      // No default org → no org-scoped tree to diff against.
      if (!orgId) return;

      const currentClassItems = yield* Ref.get(classItems);
      yield* Effect.forEach(
        [...changes],
        ([fullName, changeType]) =>
          Effect.gen(function* () {
            const discoveredClass = discoveryMap.get(fullName);
            const existingClassItem = currentClassItems.get(fullName);

            if (changeType === 'created' || (!existingClassItem && discoveredClass)) {
              if (discoveredClass) {
                yield* addClassToTree(ctx, discoveredClass, classNameToUri, orgId);
              }
            } else if (changeType === 'changed' && existingClassItem && discoveredClass) {
              // Always apply stale tags for filtering (remove active tags)
              yield* Effect.sync(() => {
                existingClassItem.children.forEach(methodItem => {
                  const existingTags = methodItem.tags ?? [];
                  if (!existingTags.some(t => t.id === STALE) && ctx.staleTag) {
                    methodItem.tags = [...existingTags, ctx.staleTag];
                  }
                });
                // Invalidate existing results before diffing (so new methods aren't marked stale)
                ctx.controller.invalidateTestResults(existingClassItem);
              });
              yield* diffClassMethods(ctx, fullName, existingClassItem, discoveredClass, classNameToUri);
            } else if (existingClassItem && !discoveredClass) {
              // Class no longer in discovery (e.g. @isTest removed) — remove it
              yield* removeClassFromTree(ctx, fullName);
            }
          }),
        { concurrency: 1 }
      );
    });

    /**
     * Incrementally update the tree from deployed metadata changes, preserving results for unchanged classes.
     * Non-fatal: any failure is logged and swallowed (the existing tree stays valid). Deletions apply
     * immediately; created/changed entries trigger a fresh discovery + diff.
     */
    const incrementalUpdate = Effect.fn('ApexTestTreeService.incrementalUpdate')(function* (
      ctx: TreeMutationContext,
      changes: Map<string, string>,
      includesSuiteChange: boolean
    ) {
      yield* Effect.gen(function* () {
        // Handle deletions immediately (no API call needed)
        yield* Effect.forEach(
          [...changes].filter(([, changeType]) => changeType === 'deleted'),
          ([fullName]) => removeClassFromTree(ctx, fullName),
          { concurrency: 1 }
        );

        // If any created/changed entries remain, call discovery API and apply diff
        const nonDeleteChanges = new Map([...changes].filter(([, changeType]) => changeType !== 'deleted'));
        if (nonDeleteChanges.size > 0) {
          const discoveryResult = yield* discoverTests();
          yield* persistDiscoveredClasses(discoveryResult.classes);
          yield* applyIncrementalDiff(ctx, discoveryResult.classes, nonDeleteChanges);
        }

        if (includesSuiteChange) {
          yield* clearAllSuiteChildren();
        }
      }).pipe(
        // Broad by design: the inner pipeline mixes error types (discoverTests fails with a plain `Error`,
        // addClassToTree with PackageResolutionError), and incremental update is a non-fatal optimization —
        // any failure logs and leaves the existing tree valid, so there's no need to switch per tag.
        Effect.catchAll(error =>
          Effect.logWarning('Incremental test-tree update failed (non-fatal)', {
            message: toUserFriendlyApexTestError(error)
          })
        )
      );
    });

    /**
     * Lazily resolve a suite's member classes (Tooling API) into placeholder child items and record the
     * suite→classes mapping in the Ref. Connection/query failures map to ResolveSuiteChildrenError for the
     * vscode boundary to notify.
     */
    const resolveSuiteChildren = Effect.fn('ApexTestTreeService.resolveSuiteChildren')(function* (
      ctx: TreeMutationContext,
      suiteItem: vscode.TestItem
    ) {
      // If children are already populated, skip
      if (suiteItem.children.size > 0) {
        return;
      }
      const suiteName = extractSuiteName(suiteItem.id);
      if (!suiteName) {
        return;
      }

      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const connection = yield* api.services.ConnectionService.getConnection().pipe(
        Effect.mapError(e => new ResolveSuiteChildrenError({ suiteName, message: toUserFriendlyApexTestError(e) }))
      );

      const classNames = yield* Effect.tryPromise({
        try: async () => {
          const classesInSuite = await new TestService(connection).getTestsInSuite(suiteName);
          if (classesInSuite.length === 0) {
            return [];
          }
          const classIds = classesInSuite.map(record => record.ApexClassId);
          const classNamesQuery = `SELECT Id, Name, NamespacePrefix FROM ApexClass WHERE Id IN (${classIds.map(id => `'${id.replaceAll("'", "''")}'`).join(',')})`;
          const queryResult = await connection.tooling.query<{ Name: string; NamespacePrefix: string | null }>(
            classNamesQuery
          );
          return queryResult.records.map((record: { Name: string; NamespacePrefix?: string | null }) =>
            record.NamespacePrefix?.trim() ? `${record.NamespacePrefix}.${record.Name}` : record.Name
          );
        },
        catch: e => new ResolveSuiteChildrenError({ suiteName, message: toUserFriendlyApexTestError(e) })
      });

      if (classNames.length === 0) {
        yield* Effect.logDebug('No test classes found for suite', { suiteName });
        return;
      }

      const currentClassItems = yield* Ref.get(classItems);
      // Store the mapping of suite to classes (full class names for lookup)
      yield* setSuiteClasses(suiteName, new Set(classNames));

      yield* Effect.sync(() => {
        // Add class items as children of the suite (placeholders; actual class items live under namespace/package)
        classNames.forEach(className => {
          const existingClassItem = currentClassItems.get(className);
          const classItem = ctx.controller.createTestItem(
            createSuiteClassId(suiteName, className),
            className,
            existingClassItem?.uri
          );
          suiteItem.children.add(classItem);
        });
      });
    });

    /** Clear every suite item's children so they re-query from the org on next expand. */
    const clearAllSuiteChildren = Effect.fn('ApexTestTreeService.clearAllSuiteChildren')(function* () {
      const currentSuiteItems = yield* Ref.get(suiteItems);
      yield* Effect.sync(() => {
        currentSuiteItems.forEach(suiteItem => suiteItem.children.replace([]));
      });
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
      getSuiteToClasses,
      markStaleTags,
      clearStaleTags,
      reset,
      clearRestoredResults,
      restorePreviousResults,
      discover,
      incrementalUpdate,
      resolveSuiteChildren,
      clearAllSuiteChildren
    };
  })
}) {}
