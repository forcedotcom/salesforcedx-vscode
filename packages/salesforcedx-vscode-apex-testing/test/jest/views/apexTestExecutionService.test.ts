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

// The execution service now builds `new TestService(connection)` in-body (connection from
// ConnectionService.getConnection). Mock the constructor to return a controllable instance per test.
let activeTestService: unknown;
jest.mock('@salesforce/apex-node', () => ({
  ...jest.requireActual('@salesforce/apex-node'),
  TestService: jest.fn().mockImplementation(() => activeTestService)
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

// writeTestResultJsonFile now returns an Effect (default Effect.void); readTestRunIdFile stays a Promise.
const mockWriteTestResultJsonFile = jest.fn((..._a: unknown[]) => Effect.void);
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
// Mirror the prior settings-mock defaults through the SettingsService accessor.
const settingsValues: Record<string, unknown> = {
  'retrieve-test-code-coverage': false,
  'test-run-concise': false,
  outputFormat: 'text',
  testSortOrder: 'runtime'
};
const mockApi = {
  services: {
    ChannelService: Effect.succeed({ appendToChannel }),
    FsService: { readFile: (uri: URI) => readFile(uri) },
    // Yielded as an instance (yield* api.services.SettingsService), so wrap in Effect.succeed.
    SettingsService: Effect.succeed({
      getValue: (_section: string, key: string, defaultValue: unknown) =>
        Effect.succeed(key in settingsValues ? settingsValues[key] : defaultValue)
    }),
    // getConnection is a static accessor (api.services.ConnectionService.getConnection()); the returned
    // connection is only fed to `new TestService(conn)`, which the module mock intercepts, so a stub is fine.
    ConnectionService: { getConnection: () => Effect.succeed({}) }
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
  ...overrides
});

/** Install the TestService instance that the in-body `new TestService(conn)` will return. */
const setTestService = (svc: TestService) => {
  activeTestService = svc;
};

describe('ApexTestExecutionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default TestService for the in-body `new TestService(conn)`; individual tests override via setTestService.
    activeTestService = makeTestService();
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
      setTestService(makeTestService());
      await runEff(
        ApexTestExecutionService.executeTests({
          testNames: ['MyClass.testA'],
          outputDir: URI.file('/tmp'),
          codeCoverage: false,
          token: cancellationToken,
          run,
          testsToRun: [method],
          runAllTestsInOrg: false
        })
      );
      expect(appendToChannel).toHaveBeenCalledTimes(1);
      expect(appendToChannel).toHaveBeenCalledWith('Ended SFDX: Run Apex Tests');
    });

    it('uses the RunAllTestsInOrg payload (no buildAsyncPayload) when runAllTestsInOrg', async () => {
      const buildAsyncPayload = jest.fn();
      const runTestAsynchronous = jest.fn().mockResolvedValue({ tests: [], summary: { testsRan: 1 } });
      setTestService(makeTestService({ buildAsyncPayload, runTestAsynchronous }));
      const { run } = fakeRun();
      await runEff(
        ApexTestExecutionService.executeTests({
          testNames: [],
          outputDir: URI.file('/tmp'),
          codeCoverage: false,
          token: cancellationToken,
          run,
          testsToRun: [],
          runAllTestsInOrg: true
        })
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
      setTestService(makeTestService({ runTestAsynchronous }));
      const ctx = makeCtx();
      // executeTests writes the Ref; a subsequent onResultFileCreate for the same file must skip re-apply.
      mockReadTestRunIdFile.mockResolvedValue('RID');
      await runEff(
        Effect.gen(function* () {
          yield* ApexTestExecutionService.executeTests({
            testNames: ['MyClass.testA'],
            outputDir: URI.file('/tmp'),
            codeCoverage: false,
            token: cancellationToken,
            run,
            testsToRun: [method],
            runAllTestsInOrg: false
          });
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
          yield* ApexTestExecutionService.executeTests({
            testNames: ['MyClass.testA'],
            outputDir: URI.file('/tmp'),
            codeCoverage: false,
            token: cancellationToken,
            run,
            testsToRun: [method],
            runAllTestsInOrg: false
          });
        })
      );
      expect(method.tags?.some(t => t.id === 'stale')).toBe(false);
    });

    it('fails with PayloadBuildError when no payload is produced', async () => {
      const class1 = fakeItem('class:A', 'A');
      const suite1 = fakeItem('suite:S', 'S');
      const { run } = fakeRun();
      setTestService(makeTestService({ buildAsyncPayload: jest.fn().mockResolvedValue(undefined) }));
      // Mixed suite+class with no methods -> buildTestPayload reaches the no-payload branch.
      const exit = await runExit(
        ApexTestExecutionService.executeTests({
          testNames: ['A'],
          outputDir: URI.file('/tmp'),
          codeCoverage: false,
          token: cancellationToken,
          run,
          testsToRun: [suite1, class1],
          runAllTestsInOrg: false
        })
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

    it('errors the item with the failed-debug message when the debug command rejects', async () => {
      const cls = fakeItem('class:A', 'A', { tags: [inWorkspaceTag] });
      const { run, errored } = fakeRun();
      (vscode.commands.executeCommand as jest.Mock).mockReset();
      (vscode.commands.executeCommand as jest.Mock).mockRejectedValue(new Error('dispatch boom'));
      await runEff(ApexTestExecutionService.debugTests(makeCtx(), [cls], run));
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('sf.test.view.debugTests', { name: 'A' });
      expect(errored.map(e => e.test)).toContain(cls);
      expect((errored[0].message as unknown as { message: string }).message).toContain('Debug failed:');
    });

    it('skips method-level debug dispatch for a class already selected at class level', async () => {
      const cls = fakeItem('class:A', 'A', { tags: [inWorkspaceTag] });
      const method = fakeItem('method:A.testA', 'testA', { tags: [inWorkspaceTag] });
      const { run } = fakeRun();
      (vscode.commands.executeCommand as jest.Mock).mockReset();
      (vscode.commands.executeCommand as jest.Mock).mockResolvedValue(undefined);
      await runEff(ApexTestExecutionService.debugTests(makeCtx(), [cls, method], run));
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('sf.test.view.debugTests', { name: 'A' });
      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
        'sf.test.view.debugSingleTest',
        expect.anything()
      );
    });

    it('errors a suite item with the not-supported message and does not dispatch it', async () => {
      const suite = fakeItem('suite:S', 'S', { tags: [inWorkspaceTag] });
      const { run, errored } = fakeRun();
      (vscode.commands.executeCommand as jest.Mock).mockReset();
      (vscode.commands.executeCommand as jest.Mock).mockResolvedValue(undefined);
      await runEff(ApexTestExecutionService.debugTests(makeCtx(), [suite], run));
      expect(errored.map(e => e.test)).toContain(suite);
      expect((errored[0].message as unknown as { message: string }).message).toContain(
        'Test suites cannot be debugged'
      );
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('runTests', () => {
    it('surfaces a run failure on every test via run.errored (run still ends)', async () => {
      const method = fakeItem('method:MyClass.testA', 'testA');
      const { run, errored, end } = fakeRun();
      const runTestAsynchronous = jest.fn().mockRejectedValue(new Error('async run boom'));
      setTestService(makeTestService({ runTestAsynchronous }));
      const ctx = makeCtx({
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
      setTestService(makeTestService({ runTestAsynchronous }));
      const ctx = makeCtx({
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
      setTestService(makeTestService({ runTestAsynchronous }));
      // suite:Empty has no entry in the tree-service suiteToClasses Ref, so runTests treats it as empty.
      const ctx = makeCtx({
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
