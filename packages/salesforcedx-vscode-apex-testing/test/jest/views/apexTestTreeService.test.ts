/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// discoverTests is a module-level Effect; the dedup tests count body runs via ensureInitialized, so a
// trivially-succeeding discovery keeps the body cheap. The mock returns an Effect (consumed via yield*).
const mockDiscoverTests = jest.fn();
jest.mock('../../../src/testDiscovery/testDiscovery', () => {
  const EffectLib = jest.requireActual('effect/Effect');
  return { discoverTests: () => mockDiscoverTests() ?? EffectLib.succeed({ classes: [] }) };
});

jest.mock('../../../src/settings', () => ({
  retrieveRestorePreviousResults: jest.fn().mockReturnValue(false),
  disableRestorePreviousResults: jest.fn()
}));

// getTestResultsFolder normally needs TargetOrgRef/WorkspaceService/FsService.createDirectory; the
// restore-apply test only cares about the dir-listing + apply loop, so return a fixed folder URI.
const mockGetTestResultsFolder = jest.fn();
jest.mock('../../../src/utils/pathHelpers', () => {
  const EffectLib = jest.requireActual('effect/Effect');
  return { getTestResultsFolder: () => mockGetTestResultsFolder() ?? EffectLib.succeed({ toString: () => 'dir' }) };
});

// Break the import cycle apexTestTreeService -> coreExtensionUtils -> extensionProvider (whose layer
// references ApexTestTreeService.Default at module-eval). The tests provide layers directly via
// Effect.provide, so the runtime accessor here is never used.
jest.mock('../../../src/services/extensionProvider', () => ({
  getApexTestingRuntime: jest.fn(),
  setAllServicesLayer: jest.fn()
}));

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Logger from 'effect/Logger';
import * as Ref from 'effect/Ref';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { nls } from '../../../src/messages';
import { ApexTestTreeService, type DiscoveryContext } from '../../../src/views/apexTestTreeService';

// Minimal ambient services: discovery reaches getServicesApi; the no-classes path never touches FsService.
const mockServicesApi = { services: {} };
const ExtensionProviderLayer = Layer.succeed(ExtensionProviderService, {
  getServicesApi: Effect.succeed(mockServicesApi)
} as unknown as ExtensionProviderService);

// baseLayer() constructs a fresh service instance (fresh Refs) per call, so every run() is isolated.
// The restore-apply test builds its own layerWithFs instead of reusing baseLayer: it needs a real FsService
// in the ambient env (the restore body yields ExtensionProviderService at call time), which the bare
// ExtensionProviderLayer here does not provide.
const baseLayer = () => Layer.provide(ApexTestTreeService.Default, ExtensionProviderLayer);

const run = <A, E, R>(effect: Effect.Effect<A, E, ApexTestTreeService | R>) =>
  Effect.runPromise(Effect.provide(effect as Effect.Effect<A, E, ApexTestTreeService>, baseLayer()));

const fakeTestItem = (id: string): vscode.TestItem => ({ id, label: id }) as unknown as vscode.TestItem;

// A controllable DiscoveryContext: ensureInitialized count proves how many times the body actually ran;
// the gate Deferred lets a test hold the body open while a second caller arrives (dedup window).
const makeContext = (
  overrides: Partial<DiscoveryContext> & { onEnsureInitialized?: () => Promise<void> } = {}
): DiscoveryContext => {
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
    ensureInitialized: overrides.onEnsureInitialized ?? (() => Promise.resolve()),
    clearTree: jest.fn(),
    getConnection: () => ({}) as never,
    getTestService: () => ({ retrieveAllSuites: () => Promise.resolve([]) }),
    persistDiscoveredClasses: () => Promise.resolve(),
    updateTestResults: () => Promise.resolve(),
    applyStaleTags: jest.fn(),
    getMethodIdsFromResultFile: () => Promise.resolve(new Set<string>()),
    ...overrides
  };
};

describe('ApexTestTreeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDiscoverTests.mockReturnValue(undefined);
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
      // clearTree runs exactly once per discovery body (unlike ensureInitialized, which both discoverBody
      // and populateSuiteItems call), so it is the precise body-run counter.
      const clearTree = jest.fn();
      const gate = await Effect.runPromise(Deferred.make<void>());
      const ctx = makeContext({
        clearTree,
        onEnsureInitialized: async () => {
          // Hold the first body open until released, so the second discover arrives mid-flight.
          await Effect.runPromise(Deferred.await(gate));
        }
      });

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
      const ctx = makeContext({
        onEnsureInitialized: () => Promise.reject(new Error('boom: connection failed')),
        clearTree: jest.fn()
      });
      await run(ApexTestTreeService.discover(ctx));
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('boom: connection failed');
      expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    });

    it('shows a warning (not error) when discovery fails with the partial-discovery message', async () => {
      // toUserFriendlyApexTestError maps a 431 message to apex_test_discovery_partial_warning.
      const ctx = makeContext({
        onEnsureInitialized: () => Promise.reject(new Error('431 Request Header Fields Too Large'))
      });
      await run(ApexTestTreeService.discover(ctx));
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        nls.localize('apex_test_discovery_partial_warning')
      );
      expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });
  });

  describe('restorePreviousResults test-and-set', () => {
    it('only one of two concurrent restores proceeds past the isRestoringResults guard', async () => {
      // retrieveRestorePreviousResults is mocked false, so a proceeding restore short-circuits right
      // after the guard. We observe the guard directly: a second concurrent call sees the flag set.
      const settings = jest.requireMock('../../../src/settings');
      let bodyEntries = 0;
      settings.retrieveRestorePreviousResults.mockImplementation(() => {
        bodyEntries++;
        return false;
      });
      const ctx = makeContext();

      await run(
        Effect.gen(function* () {
          // Pre-set the in-flight flag to simulate an active restore; the second call must skip.
          const svc = yield* ApexTestTreeService;
          yield* Ref.set(svc.isRestoringResults, true);
          yield* ApexTestTreeService.restorePreviousResults(ctx);
        })
      );

      // Guard short-circuited: the body (retrieveRestorePreviousResults) was never reached.
      expect(bodyEntries).toBe(0);
    });

    it('proceeds and resets the flag when no restore is in flight', async () => {
      const settings = jest.requireMock('../../../src/settings');
      let bodyEntries = 0;
      settings.retrieveRestorePreviousResults.mockImplementation(() => {
        bodyEntries++;
        return false;
      });
      const ctx = makeContext();

      await run(
        Effect.gen(function* () {
          yield* ApexTestTreeService.restorePreviousResults(ctx);
          const svc = yield* ApexTestTreeService;
          // Flag reset in ensuring after the (short-circuited) body.
          expect(yield* Ref.get(svc.isRestoringResults)).toBe(false);
        })
      );

      expect(bodyEntries).toBe(1);
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
      const settings = jest.requireMock('../../../src/settings');
      settings.retrieveRestorePreviousResults.mockReturnValue(true);
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
        stat: (uri: URI) => Effect.succeed({ mtime: mtimes.get(uri.path)! })
      };
      const ExtProviderWithFs = Layer.succeed(ExtensionProviderService, {
        getServicesApi: Effect.succeed({ services: { FsService: fsService } })
      } as unknown as ExtensionProviderService);
      // ExtProviderWithFs both satisfies ApexTestTreeService.Default and stays in the ambient env (the
      // restore body yields ExtensionProviderService at call time in the caller's context).
      const layerWithFs = Layer.merge(Layer.provide(ApexTestTreeService.Default, ExtProviderWithFs), ExtProviderWithFs);

      const applied: string[] = [];
      const ctx = makeContext({
        sessionStartTime: 0,
        getMethodIdsFromResultFile: () => Promise.resolve(new Set<string>()),
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

      await Effect.runPromise(
        Effect.provide(
          ApexTestTreeService.restorePreviousResults(ctx).pipe(
            Effect.provide(Logger.replace(Logger.defaultLogger, captureLogger))
          ),
          layerWithFs
        )
      );

      // u1 applied, u2 attempted (rejects), u3 NOT reached -> concurrency:1 sequential ordering.
      expect(applied).toEqual([u1.path, u2.path]);
      // Per-item RestoreResultsError carries the offending URI, not an opaque bucket.
      expect(logged.some(l => l.annotations.uri === u2.path)).toBe(true);
    });
  });
});
