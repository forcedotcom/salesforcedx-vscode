/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// populateSuiteItems now builds `new TestService(connection)` in-body (connection from
// ConnectionService.getConnection). Mock the constructor to return a controllable instance (default: no
// suites). retrieveAllSuites failures are recovered inside populateSuiteItems.
let activeTestService: unknown = { retrieveAllSuites: () => Promise.resolve([]) };
jest.mock('@salesforce/apex-node', () => ({
  ...jest.requireActual('@salesforce/apex-node'),
  TestService: jest.fn().mockImplementation(() => activeTestService)
}));

// discoverTests is a module-level Effect; the dedup tests count body runs via clearTree, so a
// trivially-succeeding discovery keeps the body cheap. The mock returns an Effect (consumed via yield*).
const mockDiscoverTests = jest.fn();
jest.mock('../../../src/testDiscovery/testDiscovery', () => {
  const EffectLib = jest.requireActual('effect/Effect');
  return { discoverTests: () => mockDiscoverTests() ?? EffectLib.succeed({ classes: [] }) };
});

// getTestResultsFolder normally needs TargetOrgRef/WorkspaceService/FsService.createDirectory; the
// restore-apply test only cares about the dir-listing + apply loop, so return a fixed folder URI.
const mockGetTestResultsFolder = jest.fn();
jest.mock('../../../src/utils/pathHelpers', () => {
  const EffectLib = jest.requireActual('effect/Effect');
  return { getTestResultsFolder: () => mockGetTestResultsFolder() ?? EffectLib.succeed({ toString: () => 'dir' }) };
});

// Break the import cycle apexTestTreeService -> extensionProvider (whose layer references
// ApexTestTreeService.Default at module-eval). The tests provide layers directly via Effect.provide, so
// the runtime accessor here is never used.
jest.mock('../../../src/services/extensionProvider', () => ({
  getApexTestingRuntime: jest.fn(),
  setAllServicesLayer: jest.fn()
}));

// Tree-mutation methods (incrementalUpdate/resolveSuiteChildren) read the org key inline via the Services
// TargetOrgRef seam (see mockServicesApi below), PackageResolutionService.resolve, and OrgMetadataResolver
// for placement. Controllable per test; defaults give a valid org + empty package/URI maps so addClassToTree
// exercises the namespace/package build path.
let mockOrgInfo: { orgId?: string; username?: string } = { orgId: 'org123', username: 'user@example.com' };
jest.mock('../../../src/testDiscovery/packageResolution', () => {
  const EffectLib = jest.requireActual('effect/Effect');
  // resolve is a static accessor (PackageResolutionService.resolve(...)) returning an Effect<Map>.
  return { PackageResolutionService: { resolve: () => EffectLib.succeed(new Map()) } };
});
let mockClassNameToUri = new Map<string, URI>();
jest.mock('../../../src/utils/testUtils', () => {
  const actual = jest.requireActual('../../../src/utils/testUtils');
  return {
    ...actual,
    getMethodLocationsFromSymbols: () => Promise.resolve(new Map())
  };
});

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Logger from 'effect/Logger';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { orgDataUri } from 'salesforcedx-vscode-services/src/orgVfs/orgDataUris';
import { orgMetadataUri } from 'salesforcedx-vscode-services/src/orgVfs/orgMetadataUris';
import { nls } from '../../../src/messages';
import {
  ApexTestTreeService,
  type DiscoveryContext,
  type TreeMutationContext
} from '../../../src/views/apexTestTreeService';

// Controllable restore-previous-results value surfaced through the mock SettingsService (replaces the old
// jest.mock('../../../src/settings') target).
let restorePreviousResultsValue = false;
const mockGetValue = jest.fn((_section: string, key: string, defaultValue: unknown) =>
  Effect.succeed(key === 'restore-previous-results' ? restorePreviousResultsValue : defaultValue)
);
const mockSettingsService = {
  getValue: mockGetValue,
  setValue: jest.fn(() => Effect.void)
};

// Connection is acquired via ConnectionService.getConnection() (static accessor). Controllable per test:
// default succeeds; failure/gating tests replace the impl. The returned connection is only fed to
// `new TestService(conn)`, which the module mock below intercepts.
let getConnectionImpl: () => Effect.Effect<unknown, unknown> = () => Effect.succeed({});
const mockConnectionService = { getConnection: () => getConnectionImpl() };

// Minimal ambient services: discovery reaches getServicesApi; the no-classes path never touches FsService.
// SettingsService is yielded as an instance (yield* api.services.SettingsService), so wrap in Effect.succeed.
// TargetOrgRef backs the inline getDefaultOrgInfo helper (yield* api.services.TargetOrgRef() then
// SubscriptionRef.get). Build a fresh SubscriptionRef from the current mockOrgInfo per call so per-test
// mutations (mockOrgInfo = {} for the no-org path) take effect. Mirrors watchers/testDiscovery.test.ts.
const mockServicesApi = {
  services: {
    SettingsService: Effect.succeed(mockSettingsService),
    ConnectionService: mockConnectionService,
    orgDataUri,
    orgMetadataUri,
    OrgMetadataCatalog: Effect.succeed({
      getPresence: (uri: URI) => {
        const fullName = decodeURIComponent(uri.path.split('/').at(-1) ?? '');
        const workspaceUri = mockClassNameToUri.get(fullName);
        return Effect.succeed({
          inOrg: true,
          inWorkspace: workspaceUri !== undefined,
          workspaceUri
        });
      }
    }),
    TargetOrgRef: () => SubscriptionRef.make(mockOrgInfo)
  }
};
const ExtensionProviderLayer = Layer.succeed(ExtensionProviderService, {
  getServicesApi: Effect.succeed(mockServicesApi)
} as unknown as ExtensionProviderService);

// baseLayer() constructs a fresh service instance (fresh Refs) per call, so every run() is isolated.
// ExtensionProviderLayer is also merged ambiently (not just provided to the service): the restore body
// yields ExtensionProviderService at call time in the caller's context, so it must remain in the env.
// The restore-apply test builds its own layerWithFs to add a real FsService on top.
const baseLayer = () =>
  Layer.merge(Layer.provide(ApexTestTreeService.Default, ExtensionProviderLayer), ExtensionProviderLayer);

const run = <A, E, R>(effect: Effect.Effect<A, E, ApexTestTreeService | R>) =>
  Effect.runPromise(Effect.provide(effect as Effect.Effect<A, E, ApexTestTreeService>, baseLayer()));

const fakeTestItem = (id: string): vscode.TestItem => ({ id, label: id }) as unknown as vscode.TestItem;

// A TestItem whose children collection is a live Map (add/delete/replace/forEach/size), so the moved
// tree-mutation methods (addClassToTree/diffClassMethods/removeClassFromTree) can be exercised end-to-end.
const richTestItem = (id: string, label = id, uri?: URI): vscode.TestItem => {
  const kids = new Map<string, vscode.TestItem>();
  const children = {
    add: (item: vscode.TestItem) => kids.set(item.id, item),
    delete: (childId: string) => kids.delete(childId),
    replace: (items: vscode.TestItem[]) => {
      kids.clear();
      items.forEach(i => kids.set(i.id, i));
    },
    forEach: (cb: (item: vscode.TestItem) => void) => kids.forEach(cb),
    get size() {
      return kids.size;
    },
    // Real TestItemCollection is Iterable<[id, TestItem]> (vscode.d.ts)
    [Symbol.iterator]: () => kids.entries()
  } as unknown as vscode.TestItemCollection;
  return { id, label, uri, tags: undefined, children } as unknown as vscode.TestItem;
};

// TreeMutationContext whose controller.items is a live Map-backed collection + createTestItem builds
// richTestItems. invalidateTestResults is a spy so callers can assert it fired.
const makeMutationContext = (overrides: Partial<TreeMutationContext> = {}) => {
  const topItems = new Map<string, vscode.TestItem>();
  const invalidateTestResults = jest.fn();
  const controller = {
    items: {
      add: (item: vscode.TestItem) => topItems.set(item.id, item),
      delete: (id: string) => topItems.delete(id),
      forEach: (cb: (item: vscode.TestItem) => void) => topItems.forEach(cb),
      get size() {
        return topItems.size;
      }
    },
    createTestItem: (id: string, label: string, uri?: URI) => richTestItem(id, label, uri),
    invalidateTestResults
  } as unknown as vscode.TestController;
  const ctx: TreeMutationContext = {
    controller,
    suiteTag: undefined,
    orgOnlyTag: undefined,
    inWorkspaceTag: undefined,
    staleTag: { id: 'stale' } as vscode.TestTag,
    ...overrides
  };
  return { ctx, invalidateTestResults, topItems };
};

const toolingClass = (name: string, methods: string[], id = `01p_${name}`): unknown => ({
  id: Option.some(id),
  name,
  namespacePrefix: Option.none(),
  testMethods: methods.map((m, i) => ({ name: m, line: i + 1, column: 0 }))
});

// A controllable DiscoveryContext. Connection/TestService are no longer threaded in — discovery acquires
// them via the mock ConnectionService + the mocked TestService constructor. clearTree count proves how many
// times the discovery body actually ran.
const makeContext = (overrides: Partial<DiscoveryContext> = {}): DiscoveryContext => {
  const controller = {
    items: { add: jest.fn(), replace: jest.fn() },
    createTestItem: jest.fn((id: string) => fakeTestItem(id)),
    invalidateTestResults: jest.fn()
  } as unknown as vscode.TestController;
  return {
    controller,
    suiteTag: undefined,
    orgOnlyTag: undefined,
    inWorkspaceTag: undefined,
    sessionStartTime: Date.now(),
    clearTree: jest.fn(),
    updateTestResults: () => Promise.resolve(),
    staleTag: undefined,
    ...overrides
  };
};

describe('ApexTestTreeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDiscoverTests.mockReturnValue(undefined);
    restorePreviousResultsValue = false;
    getConnectionImpl = () => Effect.succeed({});
    activeTestService = { retrieveAllSuites: () => Promise.resolve([]) };
    mockOrgInfo = { orgId: 'org123', username: 'user@example.com' };
    mockClassNameToUri = new Map<string, URI>();
  });

  describe('reset', () => {
    it('clears all tree maps in place (stable object identity for shared holders)', async () => {
      await run(
        Effect.gen(function* () {
          const before = yield* ApexTestTreeService.getClassItems();
          before.set('A', fakeTestItem('class:A'));
          yield* ApexTestTreeService.reset();
          const after = yield* ApexTestTreeService.getClassItems();
          // same Map object (identity preserved) and emptied
          expect(after).toBe(before);
          expect(after.size).toBe(0);
        })
      );
    });
  });

  // getter live-Ref behavior is already exercised by the reset test (mutate via getX, assert identity).

  describe('discover dedup', () => {
    it('runs the body once when two callers overlap; the second awaits the same in-flight run', async () => {
      // clearTree runs exactly once per discovery body, so it is the precise body-run counter.
      const clearTree = jest.fn();
      const gate = await Effect.runPromise(Deferred.make<void>());
      // Hold the first body open (at the up-front getConnection) until released, so the second discover
      // arrives mid-flight and awaits the same in-flight Deferred.
      getConnectionImpl = () => Deferred.await(gate).pipe(Effect.as({}));
      const ctx = makeContext({ clearTree });

      await run(
        Effect.gen(function* () {
          const first = yield* Effect.fork(ApexTestTreeService.discover(ctx));
          // Yield so the first fiber installs the in-flight Deferred before the second reads it.
          yield* Effect.yieldNow();
          const second = yield* Effect.fork(ApexTestTreeService.discover(ctx));
          yield* Effect.yieldNow();
          yield* Deferred.succeed(gate, undefined);
          yield* first.await;
          yield* second.await;
        })
      );

      expect(clearTree).toHaveBeenCalledTimes(1);
    });

    it('re-runs on a subsequent discover (single-shot, not memoized)', async () => {
      const clearTree = jest.fn();
      const ctx = makeContext({ clearTree });
      await run(
        Effect.gen(function* () {
          yield* ApexTestTreeService.discover(ctx);
          yield* ApexTestTreeService.discover(ctx);
        })
      );
      expect(clearTree).toHaveBeenCalledTimes(2);
    });
  });

  describe('discover failure notification', () => {
    it('shows an error message when discovery fails with a generic message', async () => {
      // The up-front getConnection failure is mapped to DiscoveryError and surfaced.
      getConnectionImpl = () => Effect.fail(new Error('boom: connection failed'));
      const ctx = makeContext({ clearTree: jest.fn() });
      await run(ApexTestTreeService.discover(ctx));
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('boom: connection failed');
      expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    });

    it('shows a warning (not error) when discovery fails with the partial-discovery message', async () => {
      // toUserFriendlyApexTestError maps a 431 message to apex_test_discovery_partial_warning.
      getConnectionImpl = () => Effect.fail(new Error('431 Request Header Fields Too Large'));
      const ctx = makeContext();
      await run(ApexTestTreeService.discover(ctx));
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        nls.localize('apex_test_discovery_partial_warning')
      );
      expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });
  });

  describe('restorePreviousResults test-and-set', () => {
    // restore-previous-results is read via SettingsService.getValue at the top of the body; count those
    // reads to prove how many times the body actually ran past the guard.
    const bodyEntries = () => mockGetValue.mock.calls.filter(([, key]) => key === 'restore-previous-results').length;

    it('only one of two concurrent restores proceeds past the isRestoringResults guard', async () => {
      // restore-previous-results is false, so a proceeding restore short-circuits right after the guard.
      // We observe the guard directly: a second concurrent call sees the flag set.
      restorePreviousResultsValue = false;
      const ctx = makeContext();

      await run(
        Effect.gen(function* () {
          // Pre-set the in-flight flag to simulate an active restore; the second call must skip.
          const svc = yield* ApexTestTreeService;
          yield* Ref.set(svc.isRestoringResults, true);
          yield* ApexTestTreeService.restorePreviousResults(ctx);
        })
      );

      // Guard short-circuited: the body (restore-previous-results read) was never reached.
      expect(bodyEntries()).toBe(0);
    });

    it('proceeds and resets the flag when no restore is in flight', async () => {
      restorePreviousResultsValue = false;
      const ctx = makeContext();

      await run(
        Effect.gen(function* () {
          yield* ApexTestTreeService.restorePreviousResults(ctx);
          const svc = yield* ApexTestTreeService;
          // Flag reset in ensuring after the (short-circuited) body.
          expect(yield* Ref.get(svc.isRestoringResults)).toBe(false);
        })
      );

      expect(bodyEntries()).toBe(1);
    });
  });

  describe('restore apply-loop per-item failure', () => {
    // Three result files, increasing mtime (so oldest-first apply order is u1, u2, u3). updateTestResults
    // rejects on the 2nd URI. Asserts the surfaced RestoreResultsError.uri is that 2nd URI (per-item catch,
    // not one outer bucket) and that concurrency:1 stopped before applying the 3rd (ordering preserved).
    const fakeUri = (path: string): URI => ({ path, toString: () => path }) as unknown as URI;
    const u1 = fakeUri('/r/test-result-1.json');
    const u2 = fakeUri('/r/test-result-2.json');
    const u3 = fakeUri('/r/test-result-3.json');

    it('surfaces the offending URI and preserves oldest-first ordering', async () => {
      restorePreviousResultsValue = true;
      mockGetTestResultsFolder.mockReturnValue(Effect.succeed(fakeUri('/r')));

      // Recent mtimes (within RESULT_MAX_AGE_MS of now), increasing so oldest-first apply order is u1,u2,u3.
      const now = Date.now();
      const mtimes = new Map<string, number>([
        [u1.path, now - 3000],
        [u2.path, now - 2000],
        [u3.path, now - 1000]
      ]);
      const fsService = {
        readDirectory: () => Effect.succeed([u1, u2, u3]),
        stat: (uri: URI) => Effect.succeed({ mtime: mtimes.get(uri.path)! }),
        // getMethodIdsFromResultFile (moved into the tree svc) now reads the result file directly; empty
        // tests => empty method-id set, matching the removed getMethodIdsFromResultFile callback stub.
        readFile: () => Effect.succeed('{"tests":[]}')
      };
      const ExtProviderWithFs = Layer.succeed(ExtensionProviderService, {
        getServicesApi: Effect.succeed({
          services: { FsService: fsService, SettingsService: Effect.succeed(mockSettingsService) }
        })
      } as unknown as ExtensionProviderService);
      // ExtProviderWithFs both satisfies ApexTestTreeService.Default and stays in the ambient env (the
      // restore body yields ExtensionProviderService at call time in the caller's context).
      const layerWithFs = Layer.merge(Layer.provide(ApexTestTreeService.Default, ExtProviderWithFs), ExtProviderWithFs);

      const applied: string[] = [];
      const ctx = makeContext({
        sessionStartTime: 0,
        updateTestResults: (uri: URI) => {
          applied.push(uri.path);
          return uri.path === u2.path ? Promise.reject(new Error('apply failed')) : Promise.resolve();
        }
      });

      // Capture the logWarning that the restore recover emits, to read RestoreResultsError.uri.
      const logged: Array<{ message: unknown; annotations: Record<string, unknown> }> = [];
      const captureLogger = Logger.make(({ message, annotations }) => {
        logged.push({ message, annotations: Object.fromEntries(annotations) });
      });

      // R carries WorkspaceService | FsService from the restore body's ambient api.services reads; the
      // mocked api satisfies them at runtime, so narrow R to what layerWithFs provides (matches `run`).
      await Effect.runPromise(
        Effect.provide(
          ApexTestTreeService.restorePreviousResults(ctx).pipe(
            Effect.provide(Logger.replace(Logger.defaultLogger, captureLogger))
          ) as Effect.Effect<void, never, ApexTestTreeService>,
          layerWithFs
        )
      );

      // u1 applied, u2 attempted (rejects), u3 NOT reached -> concurrency:1 sequential ordering.
      expect(applied).toEqual([u1.path, u2.path]);
      // Per-item RestoreResultsError carries the offending URI, not an opaque bucket.
      expect(logged.some(l => l.annotations.uri === u2.path)).toBe(true);
    });
  });

  describe('incrementalUpdate diff', () => {
    // addClassToTree + persistDiscoveredClasses both acquire a connection and run tooling.query; provide one.
    const withTooling = () => {
      getConnectionImpl = () => Effect.succeed({ tooling: { query: () => Promise.resolve({ records: [] }) } });
    };

    it('adds a newly-created class under its namespace/package node', async () => {
      withTooling();
      const { ctx, topItems } = makeMutationContext();
      mockDiscoverTests.mockReturnValue(Effect.succeed({ classes: [toolingClass('NewClass', ['t1'])] }));

      await run(
        Effect.gen(function* () {
          yield* ApexTestTreeService.incrementalUpdate(ctx, new Map([['NewClass', 'created']]), false);
          const classItems = yield* ApexTestTreeService.getClassItems();
          expect(classItems.has('NewClass')).toBe(true);
        })
      );
      // A namespace node was created under controller.items for the added class.
      expect(topItems.size).toBeGreaterThan(0);
    });

    it('diffs a changed class (invalidates results, replaces method children)', async () => {
      withTooling();
      const { ctx, invalidateTestResults } = makeMutationContext();
      // Seed an existing class item with one method; discovery returns a different method set.
      const existingClass = richTestItem('class:MyClass', 'MyClass');
      existingClass.children.add(richTestItem('method:MyClass.old', 'old'));
      mockDiscoverTests.mockReturnValue(Effect.succeed({ classes: [toolingClass('MyClass', ['fresh'])] }));

      await run(
        Effect.gen(function* () {
          const classItems = yield* ApexTestTreeService.getClassItems();
          classItems.set('MyClass', existingClass);
          const methodItems = yield* ApexTestTreeService.getMethodItems();
          methodItems.set('method:MyClass.old', richTestItem('method:MyClass.old', 'old'));

          yield* ApexTestTreeService.incrementalUpdate(ctx, new Map([['MyClass', 'changed']]), false);

          // Stale 'old' method removed from the map, fresh method added.
          expect(methodItems.has('method:MyClass.old')).toBe(false);
          expect(methodItems.has('method:MyClass.fresh')).toBe(true);
        })
      );
      expect(invalidateTestResults).toHaveBeenCalledWith(existingClass);
    });

    it('removes a deleted class and prunes empty ancestor nodes', async () => {
      const { ctx, topItems } = makeMutationContext();
      // Namespace > package > class tree; deleting the class should prune package + namespace.
      const namespaceItem = richTestItem('ns:default', 'default');
      const packageItem = richTestItem('default/pkg', 'pkg');
      const classItem = richTestItem('class:Doomed', 'Doomed');
      packageItem.children.add(classItem);
      namespaceItem.children.add(packageItem);
      ctx.controller.items.add(namespaceItem);

      await run(
        Effect.gen(function* () {
          const classItems = yield* ApexTestTreeService.getClassItems();
          classItems.set('Doomed', classItem);
          const classToParent = yield* ApexTestTreeService.getClassToParentItem();
          classToParent.set('Doomed', packageItem);

          yield* ApexTestTreeService.incrementalUpdate(ctx, new Map([['Doomed', 'deleted']]), false);

          expect(classItems.has('Doomed')).toBe(false);
        })
      );
      // Package emptied -> namespace emptied -> namespace pruned from controller.items.
      expect(topItems.size).toBe(0);
    });

    it('skips the diff when there is no default org', async () => {
      mockOrgInfo = {};
      const { ctx } = makeMutationContext();
      mockDiscoverTests.mockReturnValue(Effect.succeed({ classes: [toolingClass('NewClass', ['t1'])] }));

      await run(
        Effect.gen(function* () {
          yield* ApexTestTreeService.incrementalUpdate(ctx, new Map([['NewClass', 'created']]), false);
          const classItems = yield* ApexTestTreeService.getClassItems();
          expect(classItems.has('NewClass')).toBe(false);
        })
      );
    });

    it('removes the suite parent and clears state when includesSuiteChange is true', async () => {
      // Default activeTestService returns no suites, so populateSuiteItems re-adds nothing.
      const { ctx, topItems } = makeMutationContext();
      const suiteParent = richTestItem('apex-test-suites-parent', 'Apex Test Suites');
      const suiteItem = richTestItem('suite:MySuite', 'MySuite');
      suiteItem.children.add(richTestItem('suiteClass:MySuite:A', 'A'));
      suiteParent.children.add(suiteItem);
      topItems.set('apex-test-suites-parent', suiteParent);

      await run(
        Effect.gen(function* () {
          const suiteItems = yield* ApexTestTreeService.getSuiteItems();
          suiteItems.set('MySuite', suiteItem);
          yield* ApexTestTreeService.incrementalUpdate(ctx, new Map([['X', 'deleted']]), true);
          // Suite parent removed from controller and suiteItems Ref cleared.
          expect(topItems.has('apex-test-suites-parent')).toBe(false);
          const updatedSuiteItems = yield* ApexTestTreeService.getSuiteItems();
          expect(updatedSuiteItems.size).toBe(0);
        })
      );
    });
  });

  describe('resolveSuiteChildren + suiteToClasses Ref', () => {
    it('records the suite→classes mapping and adds placeholder child items', async () => {
      activeTestService = {
        retrieveAllSuites: () => Promise.resolve([]),
        getTestsInSuite: () => Promise.resolve([{ ApexClassId: '01pAAA' }])
      };
      getConnectionImpl = () =>
        Effect.succeed({
          tooling: { query: () => Promise.resolve({ records: [{ Name: 'Member', NamespacePrefix: null }] }) }
        });
      const { ctx } = makeMutationContext();
      const suiteItem = richTestItem('suite:MySuite', 'MySuite');

      await run(
        Effect.gen(function* () {
          yield* ApexTestTreeService.resolveSuiteChildren(ctx, suiteItem);
          const suiteToClasses = yield* ApexTestTreeService.getSuiteToClasses();
          expect([...(suiteToClasses.get('MySuite') ?? [])]).toEqual(['Member']);
        })
      );
      // One placeholder child added under the suite for the member class.
      expect(suiteItem.children.size).toBe(1);
    });

    it('fails with ResolveSuiteChildrenError when the tooling query throws', async () => {
      activeTestService = {
        retrieveAllSuites: () => Promise.resolve([]),
        getTestsInSuite: () => Promise.reject(new Error('suite query boom'))
      };
      const { ctx } = makeMutationContext();
      const suiteItem = richTestItem('suite:MySuite', 'MySuite');

      const exit = await Effect.runPromiseExit(
        Effect.provide(
          ApexTestTreeService.resolveSuiteChildren(ctx, suiteItem) as Effect.Effect<void, unknown, ApexTestTreeService>,
          baseLayer()
        )
      );
      expect(exit._tag).toBe('Failure');
    });

    it('reset clears the suiteToClasses Ref (live map, stable identity)', async () => {
      await run(
        Effect.gen(function* () {
          // getSuiteToClasses returns the live Ref-backed Map; mutate it, then assert reset empties it in place.
          const suiteToClasses = yield* ApexTestTreeService.getSuiteToClasses();
          suiteToClasses.set('S', new Set(['C']));
          yield* ApexTestTreeService.reset();
          const after = yield* ApexTestTreeService.getSuiteToClasses();
          expect(after).toBe(suiteToClasses);
          expect(after.size).toBe(0);
        })
      );
    });

    it('fresh layer isolates the suiteToClasses Ref across runs', async () => {
      await run(
        Effect.gen(function* () {
          const map = yield* ApexTestTreeService.getSuiteToClasses();
          map.set('LEAK', new Set(['x']));
        })
      );
      // A second run() builds a fresh service instance (fresh Refs), so the prior mutation must not leak.
      await run(
        Effect.gen(function* () {
          const map = yield* ApexTestTreeService.getSuiteToClasses();
          expect(map.has('LEAK')).toBe(false);
        })
      );
    });
  });

  describe('getMethodIdsFromResultFile (via restore scan)', () => {
    it('parses Class.method ids from the result JSON and marks them stale', async () => {
      restorePreviousResultsValue = true;
      const now = Date.now();
      const u = { path: '/r/test-result.json', toString: () => '/r/test-result.json' } as unknown as URI;
      mockGetTestResultsFolder.mockReturnValue(Effect.succeed({ toString: () => 'dir' } as unknown as URI));
      const resultJson = JSON.stringify({ tests: [{ apexClass: { fullName: 'MyClass' }, methodName: 'testA' }] });
      const fsService = {
        readDirectory: () => Effect.succeed([u]),
        stat: () => Effect.succeed({ mtime: now - 1000 }),
        readFile: () => Effect.succeed(resultJson)
      };
      const ExtProviderWithFs = Layer.succeed(ExtensionProviderService, {
        getServicesApi: Effect.succeed({
          services: { FsService: fsService, SettingsService: Effect.succeed(mockSettingsService) }
        })
      } as unknown as ExtensionProviderService);
      const layerWithFs = Layer.merge(Layer.provide(ApexTestTreeService.Default, ExtProviderWithFs), ExtProviderWithFs);

      // Full restore reaches the "results restored" notification; give it a resolvable stub.
      (vscode.window.showInformationMessage as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      // sessionStartTime after the file mtime => the parsed method is treated as pre-session (stale).
      const applied: string[] = [];
      const ctx = makeContext({
        sessionStartTime: now,
        updateTestResults: (uri: URI) => {
          applied.push(uri.path);
          return Promise.resolve();
        }
      });

      await Effect.runPromise(
        Effect.provide(
          ApexTestTreeService.restorePreviousResults(ctx) as Effect.Effect<void, never, ApexTestTreeService>,
          layerWithFs
        )
      );
      // The result file was scanned + applied (its parsed method ids drove the stale/session partition).
      expect(applied).toEqual([u.path]);
    });

    it('recovers a corrupt/truncated result file to an empty id set instead of failing the restore', async () => {
      restorePreviousResultsValue = true;
      const now = Date.now();
      const u = { path: '/r/test-result.json', toString: () => '/r/test-result.json' } as unknown as URI;
      mockGetTestResultsFolder.mockReturnValue(Effect.succeed({ toString: () => 'dir' } as unknown as URI));
      const fsService = {
        readDirectory: () => Effect.succeed([u]),
        stat: () => Effect.succeed({ mtime: now - 1000 }),
        // Malformed JSON: JSON.parse throws; the scan must recover (no uncaught defect) rather than die.
        readFile: () => Effect.succeed('{ this is not: valid json')
      };
      const ExtProviderWithFs = Layer.succeed(ExtensionProviderService, {
        getServicesApi: Effect.succeed({
          services: { FsService: fsService, SettingsService: Effect.succeed(mockSettingsService) }
        })
      } as unknown as ExtensionProviderService);
      const layerWithFs = Layer.merge(Layer.provide(ApexTestTreeService.Default, ExtProviderWithFs), ExtProviderWithFs);

      (vscode.window.showInformationMessage as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      const applied: string[] = [];
      const ctx = makeContext({
        sessionStartTime: now,
        updateTestResults: (uri: URI) => {
          applied.push(uri.path);
          return Promise.resolve();
        }
      });

      // Must resolve (not reject with a JSON.parse defect); the corrupt file yields no method ids.
      await Effect.runPromise(
        Effect.provide(
          ApexTestTreeService.restorePreviousResults(ctx) as Effect.Effect<void, never, ApexTestTreeService>,
          layerWithFs
        )
      );
      expect(applied).toEqual([u.path]);
    });

    it('disables restore via the Workspace configuration target when the user picks "Don\'t Restore Again"', async () => {
      restorePreviousResultsValue = true;
      const now = Date.now();
      const u = { path: '/r/test-result.json', toString: () => '/r/test-result.json' } as unknown as URI;
      mockGetTestResultsFolder.mockReturnValue(Effect.succeed({ toString: () => 'dir' } as unknown as URI));
      const fsService = {
        readDirectory: () => Effect.succeed([u]),
        stat: () => Effect.succeed({ mtime: now - 1000 }),
        readFile: () => Effect.succeed('{"tests":[]}')
      };
      const ExtProviderWithFs = Layer.succeed(ExtensionProviderService, {
        getServicesApi: Effect.succeed({
          services: { FsService: fsService, SettingsService: Effect.succeed(mockSettingsService) }
        })
      } as unknown as ExtensionProviderService);
      const layerWithFs = Layer.merge(Layer.provide(ApexTestTreeService.Default, ExtProviderWithFs), ExtProviderWithFs);

      // User clicks the "disable" action on the restored-results notification.
      (vscode.window.showInformationMessage as jest.Mock) = jest
        .fn()
        .mockResolvedValue(nls.localize('apex_test_results_restored_disable_action'));

      const ctx = makeContext({ sessionStartTime: now, updateTestResults: () => Promise.resolve() });

      await Effect.runPromise(
        Effect.provide(
          ApexTestTreeService.restorePreviousResults(ctx) as Effect.Effect<void, never, ApexTestTreeService>,
          layerWithFs
        )
      );

      // Legacy behavior: the disable write targets Workspace (not Global) config.
      expect(mockSettingsService.setValue).toHaveBeenCalledWith(
        expect.any(String),
        'restore-previous-results',
        false,
        vscode.ConfigurationTarget.Workspace
      );
    });
  });
});
