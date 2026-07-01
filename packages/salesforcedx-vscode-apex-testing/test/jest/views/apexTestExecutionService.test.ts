/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Break the import cycle apexTestExecutionService -> ... -> extensionProvider (whose layer references the
// service Defaults at module-eval). Tests provide layers directly via Effect.provide.
jest.mock('../../../src/services/extensionProvider', () => ({
  getApexTestingRuntime: jest.fn(),
  setAllServicesLayer: jest.fn()
}));

jest.mock('../../../src/settings', () => ({
  retrieveTestCodeCoverage: jest.fn().mockReturnValue(false),
  retrieveTestRunConcise: jest.fn().mockReturnValue(false),
  retrieveOutputFormat: jest.fn().mockReturnValue('text'),
  retrieveTestSortOrder: jest.fn().mockReturnValue('runtime')
}));

// Keep result processing + report generation out of scope; assert orchestration only.
const mockUpdateTestRunResults = jest.fn();
jest.mock('../../../src/utils/testResultProcessor', () => ({
  updateTestRunResults: (...a: unknown[]) => mockUpdateTestRunResults(...a)
}));
jest.mock('../../../src/utils/testReportGenerator', () => {
  const EffectLib = jest.requireActual('effect/Effect');
  return { writeAndOpenTestReport: () => EffectLib.void };
});

const mockGetTestResultsFolder = jest.fn();
jest.mock('../../../src/utils/pathHelpers', () => {
  const EffectLib = jest.requireActual('effect/Effect');
  const { URI: UriClass } = jest.requireActual('vscode-uri');
  return {
    getTestResultsFolder: () => mockGetTestResultsFolder() ?? EffectLib.succeed(UriClass.file('/tmp/apex-test-results'))
  };
});

const mockWriteTestResultJsonFile = jest.fn().mockResolvedValue(undefined);
const mockReadTestRunIdFile = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../src/utils/testUtils', () => {
  const actual = jest.requireActual('../../../src/utils/testUtils');
  return {
    ...actual,
    writeTestResultJsonFile: (...a: unknown[]) => mockWriteTestResultJsonFile(...a),
    readTestRunIdFile: (...a: unknown[]) => mockReadTestRunIdFile(...a)
  };
});

import { TestService } from '@salesforce/apex-node';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { ApexTestRunCacheService } from '../../../src/testRunCache/apexTestRunCacheService';
import { ApexTestExecutionService, type ExecutionContext } from '../../../src/views/apexTestExecutionService';
import { ApexTestTreeService } from '../../../src/views/apexTestTreeService';

const appendToChannel = jest.fn(() => Effect.void);
const readFile = jest.fn((_uri: URI) => Effect.succeed(JSON.stringify({ tests: [], summary: { testsRan: 0 } })));
const mockApi = {
  services: {
    ChannelService: Effect.succeed({ appendToChannel }),
    FsService: { readFile: (uri: URI) => readFile(uri) }
  }
};
const ExtProviderLayer = Layer.succeed(ExtensionProviderService, {
  getServicesApi: Effect.succeed(mockApi)
} as unknown as ExtensionProviderService);

// Fresh tree + execution service (fresh Refs) per layer build; ExtProviderLayer also stays ambient for the
// methods that yield ExtensionProviderService at call time.
const ServicesUnderTest = Layer.mergeAll(
  ApexTestExecutionService.Default,
  ApexTestTreeService.Default,
  ApexTestRunCacheService.Default
);
const buildLayer = () => Layer.merge(Layer.provide(ServicesUnderTest, ExtProviderLayer), ExtProviderLayer);

// R is whatever the service methods require (ExecutionService/TreeService/CacheService/ExtensionProvider);
// buildLayer provides all of them, so erase R to never at the boundary.
const runEff = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.runPromise(Effect.provide(effect as Effect.Effect<A, E, never>, buildLayer()) as Effect.Effect<A, E, never>);

const runExit = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.runPromiseExit(
    Effect.provide(effect as Effect.Effect<A, E, never>, buildLayer()) as Effect.Effect<A, E, never>
  );

const tag = (id: string): vscode.TestTag => ({ id }) as vscode.TestTag;
const inWorkspaceTag = tag('in-workspace');
const orgOnlyTag = tag('org-only');
const staleTag = tag('stale');

type FakeItemOpts = { tags?: vscode.TestTag[]; children?: vscode.TestItem[] };
const fakeItem = (id: string, label: string, opts: FakeItemOpts = {}): vscode.TestItem => {
  const kids = opts.children ?? [];
  return {
    id,
    label,
    tags: opts.tags ?? [],
    children: {
      size: kids.length,
      forEach: (cb: (i: vscode.TestItem) => void) => kids.forEach(cb)
    } as unknown as vscode.TestItemCollection
  } as unknown as vscode.TestItem;
};

const fakeRun = () => {
  const started: vscode.TestItem[] = [];
  const errored: { test: vscode.TestItem; message: vscode.TestMessage }[] = [];
  const end = jest.fn();
  return {
    run: {
      started: (t: vscode.TestItem) => started.push(t),
      errored: (t: vscode.TestItem, m: vscode.TestMessage) => errored.push({ test: t, message: m }),
      appendOutput: jest.fn(),
      end
    } as unknown as vscode.TestRun,
    started,
    errored,
    end
  };
};

const cancellationToken = { isCancellationRequested: false } as vscode.CancellationToken;

const makeTestService = (
  overrides: Partial<{
    buildAsyncPayload: jest.Mock;
    runTestAsynchronous: jest.Mock;
  }> = {}
): TestService =>
  ({
    buildAsyncPayload:
      overrides.buildAsyncPayload ??
      jest.fn().mockResolvedValue({ testLevel: 'RunSpecifiedTests', skipCodeCoverage: true }),
    runTestAsynchronous:
      overrides.runTestAsynchronous ?? jest.fn().mockResolvedValue({ tests: [], summary: { testsRan: 1 } })
  }) as unknown as TestService;

const makeCtx = (overrides: Partial<ExecutionContext> = {}): ExecutionContext => ({
  controller: {
    items: { forEach: jest.fn() } as unknown as vscode.TestItemCollection,
    createTestRun: jest.fn(() => fakeRun().run)
  } as unknown as vscode.TestController,
  orgOnlyTag,
  inWorkspaceTag,
  ensureInitialized: () => Promise.resolve(),
  getTestService: () => makeTestService(),
  resolveSuiteChildren: () => Promise.resolve(),
  getSuiteToClasses: () => new Map<string, Set<string>>(),
  ...overrides
});

describe('ApexTestExecutionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    appendToChannel.mockImplementation(() => Effect.void);
    readFile.mockImplementation(() => Effect.succeed(JSON.stringify({ tests: [], summary: { testsRan: 0 } })));
    // updateTestResults uses `new vscode.TestRunRequest()` / `new vscode.TestMessage()` — make them
    // constructable under the jest vscode mock.
    const vscodeMutable = vscode as unknown as { TestRunRequest: unknown; TestMessage: unknown };
    vscodeMutable.TestRunRequest = class {};
    vscodeMutable.TestMessage = class {
      constructor(public message: string) {}
    };
  });

  describe('executeTests', () => {
    it('emits the run-path sentinel once when tests ran', async () => {
      const method = fakeItem('method:MyClass.testA', 'testA');
      const { run } = fakeRun();
      const testService = makeTestService();
      await runEff(
        ApexTestExecutionService.executeTests(
          makeCtx({ getTestService: () => testService }),
          ['MyClass.testA'],
          URI.file('/tmp'),
          false,
          cancellationToken,
          run,
          [method],
          false
        )
      );
      expect(appendToChannel).toHaveBeenCalledTimes(1);
      expect(appendToChannel).toHaveBeenCalledWith('Ended SFDX: Run Apex Tests');
    });

    it('uses the RunAllTestsInOrg payload (no buildAsyncPayload) when runAllTestsInOrg', async () => {
      const buildAsyncPayload = jest.fn();
      const runTestAsynchronous = jest.fn().mockResolvedValue({ tests: [], summary: { testsRan: 1 } });
      const testService = makeTestService({ buildAsyncPayload, runTestAsynchronous });
      const { run } = fakeRun();
      await runEff(
        ApexTestExecutionService.executeTests(
          makeCtx({ getTestService: () => testService }),
          [],
          URI.file('/tmp'),
          false,
          cancellationToken,
          run,
          [],
          true
        )
      );
      expect(buildAsyncPayload).not.toHaveBeenCalled();
      const payload = runTestAsynchronous.mock.calls[0][0] as { testLevel: string };
      expect(payload.testLevel).toBe('RunAllTestsInOrg');
    });

    it('records lastProcessedResultFile so the watcher dedupes the same URI', async () => {
      const method = fakeItem('method:MyClass.testA', 'testA');
      const { run } = fakeRun();
      const runTestAsynchronous = jest
        .fn()
        .mockResolvedValue({ tests: [], summary: { testsRan: 1, testRunId: 'RID' } });
      const ctx = makeCtx({ getTestService: () => makeTestService({ runTestAsynchronous }) });
      // executeTests writes the Ref; a subsequent onResultFileCreate for the same file must skip re-apply.
      mockReadTestRunIdFile.mockResolvedValue('RID');
      await runEff(
        Effect.gen(function* () {
          yield* ApexTestExecutionService.executeTests(
            ctx,
            ['MyClass.testA'],
            URI.file('/tmp'),
            false,
            cancellationToken,
            run,
            [method],
            false
          );
          mockUpdateTestRunResults.mockClear();
          yield* ApexTestExecutionService.onResultFileCreate(
            ctx,
            URI.file('/tmp'),
            URI.file('/tmp/test-result-RID.json')
          );
        })
      );
      // onResultFileCreate saw the same URI executeTests already claimed -> no second result apply.
      expect(mockUpdateTestRunResults).not.toHaveBeenCalled();
    });

    it('clears the stale tag from the run methods', async () => {
      const method = fakeItem('method:MyClass.testA', 'testA', { tags: [inWorkspaceTag, staleTag] });
      const { run } = fakeRun();
      await runEff(
        Effect.gen(function* () {
          const methods = yield* ApexTestTreeService.getMethodItems();
          methods.set('MyClass.testA', method);
          yield* ApexTestExecutionService.executeTests(
            makeCtx(),
            ['MyClass.testA'],
            URI.file('/tmp'),
            false,
            cancellationToken,
            run,
            [method],
            false
          );
        })
      );
      expect(method.tags?.some(t => t.id === 'stale')).toBe(false);
    });

    it('fails with PayloadBuildError when no payload is produced', async () => {
      const class1 = fakeItem('class:A', 'A');
      const suite1 = fakeItem('suite:S', 'S');
      const { run } = fakeRun();
      const testService = makeTestService({ buildAsyncPayload: jest.fn().mockResolvedValue(undefined) });
      // Mixed suite+class with no methods -> buildTestPayload reaches the no-payload branch.
      const exit = await runExit(
        ApexTestExecutionService.executeTests(
          makeCtx({ getTestService: () => testService }),
          ['A'],
          URI.file('/tmp'),
          false,
          cancellationToken,
          run,
          [suite1, class1],
          false
        )
      );
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        // Failure surfaces a tagged error (PayloadBuildError) on the typed channel.
        expect(JSON.stringify(exit.cause)).toContain('PayloadBuildError');
      }
    });
  });

  describe('debugTests', () => {
    it('errors org-only tests and does not delegate them to the debug command', async () => {
      const orgOnly = fakeItem('method:OrgOnly.testA', 'testA', { tags: [orgOnlyTag] });
      const { run, errored } = fakeRun();
      (vscode.commands.executeCommand as jest.Mock).mockClear();
      await runEff(ApexTestExecutionService.debugTests(makeCtx(), [orgOnly], run));
      expect(errored.map(e => e.test)).toContain(orgOnly);
      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith('sf.test.view.debugTests', expect.anything());
    });

    it('does NOT emit a channel sentinel on the debug path', async () => {
      const cls = fakeItem('class:A', 'A', { tags: [inWorkspaceTag] });
      const { run } = fakeRun();
      await runEff(ApexTestExecutionService.debugTests(makeCtx(), [cls], run));
      expect(appendToChannel).not.toHaveBeenCalled();
    });
  });

  describe('runTests', () => {
    it('surfaces a run failure on every test via run.errored (run still ends)', async () => {
      const method = fakeItem('method:MyClass.testA', 'testA');
      const { run, errored, end } = fakeRun();
      const runTestAsynchronous = jest.fn().mockRejectedValue(new Error('async run boom'));
      const ctx = makeCtx({
        getTestService: () => makeTestService({ runTestAsynchronous }),
        controller: {
          items: { forEach: jest.fn() } as unknown as vscode.TestItemCollection,
          createTestRun: jest.fn(() => run)
        } as unknown as vscode.TestController
      });
      await runEff(
        ApexTestExecutionService.runTests(
          ctx,
          { include: [method] } as unknown as vscode.TestRunRequest,
          cancellationToken,
          false,
          'workspace-first'
        )
      );
      expect(errored.map(e => e.test)).toContain(method);
      expect(end).toHaveBeenCalled();
    });

    it('errors the run with TestTempFolderError when the results folder cannot be resolved', async () => {
      const method = fakeItem('method:MyClass.testA', 'testA');
      const { run, errored } = fakeRun();
      mockGetTestResultsFolder.mockReturnValue(Effect.fail({ _tag: 'NoDefaultOrgError', message: 'no org' }));
      const runTestAsynchronous = jest.fn();
      const ctx = makeCtx({
        getTestService: () => makeTestService({ runTestAsynchronous }),
        controller: {
          items: { forEach: jest.fn() } as unknown as vscode.TestItemCollection,
          createTestRun: jest.fn(() => run)
        } as unknown as vscode.TestController
      });
      await runEff(
        ApexTestExecutionService.runTests(
          ctx,
          { include: [method] } as unknown as vscode.TestRunRequest,
          cancellationToken,
          false,
          'workspace-first'
        )
      );
      // getTempFolder maps the org-config failure to TestTempFolderError; runTests surfaces it per item.
      expect(errored.map(e => e.test)).toContain(method);
      expect(runTestAsynchronous).not.toHaveBeenCalled();
    });

    it('errors empty suites and ends without running when nothing remains', async () => {
      const suite = fakeItem('suite:Empty', 'Empty');
      const { run, errored, end } = fakeRun();
      const runTestAsynchronous = jest.fn();
      const ctx = makeCtx({
        getTestService: () => makeTestService({ runTestAsynchronous }),
        getSuiteToClasses: () => new Map([['Empty', new Set<string>()]]),
        controller: {
          items: { forEach: jest.fn() } as unknown as vscode.TestItemCollection,
          createTestRun: jest.fn(() => run)
        } as unknown as vscode.TestController
      });
      await runEff(
        ApexTestExecutionService.runTests(
          ctx,
          { include: [suite] } as unknown as vscode.TestRunRequest,
          cancellationToken,
          false,
          'workspace-first'
        )
      );
      expect(errored.map(e => e.test)).toContain(suite);
      expect(runTestAsynchronous).not.toHaveBeenCalled();
      expect(end).toHaveBeenCalled();
    });
  });

  describe('onResultFileCreate', () => {
    it('applies results for the expected file and dedupes a repeat for the same URI', async () => {
      readFile.mockImplementation(() => Effect.succeed(JSON.stringify({ tests: [], summary: { testsRan: 1 } })));
      mockReadTestRunIdFile.mockResolvedValue(undefined);
      const ctx = makeCtx();
      const dir = URI.file('/tmp');
      const resultUri = URI.file('/tmp/test-result.json');
      await runEff(
        Effect.gen(function* () {
          yield* ApexTestExecutionService.onResultFileCreate(ctx, dir, resultUri);
          yield* ApexTestExecutionService.onResultFileCreate(ctx, dir, resultUri);
        })
      );
      expect(mockUpdateTestRunResults).toHaveBeenCalledTimes(1);
    });
  });
});
