/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OutputDirConfig, TestResult } from '../../../src';

// Inputs for comparing writeResultFiles output with @salesforce/apex-node@9.1.13.
// Do not edit without regenerating the upstream baseline.

const summary = {
  outcome: 'Completed',
  testsRan: 3,
  passing: 2,
  failing: 1,
  skipped: 0,
  passRate: '67%',
  failRate: '33%',
  skipRate: '0%',
  testStartTime: '2023-01-01T12:00:00.000Z',
  testExecutionTimeInMs: 1500,
  testTotalTimeInMs: 2500,
  commandTimeInMs: 3500,
  hostname: 'snapshot-test-host',
  orgId: '00D000000000000EAA',
  username: 'snapshot@example.com',
  testRunId: '707000000000002AAA',
  userId: '005000000000000AAA'
};

const idSuffix = (n: number): string => String(n).padStart(6, '0');
const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);

const makeTest = (n: number, overrides: Record<string, unknown> = {}) => ({
  id: `07M000${idSuffix(n)}000AAA`.slice(0, 15),
  queueItemId: `709000${idSuffix(n)}000AAA`.slice(0, 15),
  stackTrace: null,
  message: null,
  asyncApexJobId: '707000000000001AAA',
  methodName: `testMethod${n}`,
  outcome: 'Pass',
  apexLogId: null,
  apexClass: {
    id: '01p000000000001AAA',
    name: `Class${n % 7}`,
    namespacePrefix: null,
    fullName: `Class${n % 7}`
  },
  runTime: 100 + (n % 900),
  testTimestamp: '2023-01-01T12:00:00.500Z',
  fullName: `Class${n % 7}.testMethod${n}`,
  ...overrides
});

const coverageEntry = (name: string, covered: number[], uncovered: number[]) => ({
  apexId: '01p000000000001AAA',
  name,
  type: 'ApexClass',
  numLinesCovered: covered.length,
  numLinesUncovered: uncovered.length,
  percentage: `${Math.round((covered.length / (covered.length + uncovered.length)) * 100)}%`,
  coveredLines: covered,
  uncoveredLines: uncovered
});

const perClass = (name: string, covered: number[], uncovered: number[]) => ({
  apexClassOrTriggerName: name,
  apexClassOrTriggerId: '01p000000000001AAA',
  apexTestClassId: '01p000000000002AAA',
  apexTestMethodName: 'testMethod1',
  numLinesCovered: covered.length,
  numLinesUncovered: uncovered.length,
  percentage: '80%',
  coverage: coverageEntry(name, covered, uncovered)
});

const snapshotClass = (n: number, namespacePrefix: string | null = null) => ({
  id: `01p00000000000${n}AAA`,
  name: `SnapshotTestClass${n}`,
  namespacePrefix,
  fullName: `${namespacePrefix ? `${namespacePrefix}.` : ''}SnapshotTestClass${n}`
});

const baseTests = [
  makeTest(1, {
    methodName: 'testSnapshotMethod1',
    fullName: 'SnapshotTestClass1.testSnapshotMethod1',
    apexClass: snapshotClass(1),
    runTime: 750
  }),
  makeTest(2, {
    outcome: 'Fail',
    stackTrace: 'System.AssertException: Snapshot test assertion failed',
    message: 'Snapshot test failed with detailed error message',
    apexLogId: '07L000000000001AAA',
    methodName: 'testSnapshotMethod2',
    apexClass: snapshotClass(2, 'TestNamespace'),
    fullName: 'TestNamespace.SnapshotTestClass2.testSnapshotMethod2',
    runTime: 450
  }),
  makeTest(3, {
    methodName: 'testSnapshotMethod3',
    fullName: 'SnapshotTestClass3.testSnapshotMethod3',
    apexClass: snapshotClass(3),
    runTime: 300
  })
];

const large = (() => {
  const tests = range(1, 2000).map(n =>
    makeTest(n, n % 50 === 0 ? { outcome: 'Fail', message: `failure ${n}`, stackTrace: `Class.method: line ${n}` } : {})
  );
  tests[0] = {
    ...tests[0],
    perClassCoverage: [perClass('BigClass', range(1, 2500), range(2501, 2700)), perClass('SmallClass', [1], [])]
  } as (typeof tests)[number];
  tests[1] = {
    ...tests[1],
    perClassCoverage: [
      perClass('BigClass', range(1, 1000), range(1001, 1001)),
      perClass('Exact1000', range(1, 1000), [])
    ]
  } as (typeof tests)[number];
  return {
    summary: { ...summary, testsRan: 2000, passing: 1960, failing: 40, passRate: '98%', failRate: '2%' },
    tests,
    codecoverage: [
      coverageEntry('BigClass', range(1, 2500), range(2501, 2700)),
      coverageEntry('Exact1000', range(1, 1000), []),
      coverageEntry('Empty', [], [])
    ]
  };
})();

export const parityResults = {
  base: { summary, tests: baseTests },
  withCoverage: {
    summary,
    tests: [
      { ...baseTests[0], perClassCoverage: [perClass('SnapshotTestClass1', range(1, 8), [9, 10])] },
      ...baseTests.slice(1)
    ],
    codecoverage: [coverageEntry('SnapshotTestClass1', range(1, 8), [9, 10])]
  },
  special: {
    summary: { ...summary, hostname: 'host <&> "quoted" \'apos\'', username: 'üser@exämple.com' },
    tests: [
      makeTest(1, {
        outcome: 'Fail',
        methodName: 'testSpecial<&>"\'',
        message: 'line one\r\nline two\nline three\rline four <b>bold</b> & "quotes" ]]> emoji 😀 日本語',
        stackTrace: 'Class.method: line 1, column 1\r\nClass.other: line 2, column 2\n  indented <tag> & more',
        apexLogId: '07L000000000001AAA',
        fullName: 'Class1.testSpecial<&>"\''
      }),
      makeTest(2, { outcome: 'Skip', message: 'skipped ]]>', methodName: 'testSkipped' }),
      makeTest(3, { outcome: 'CompileFail', message: null, methodName: 'testCompileFail' })
    ],
    codecoverage: [coverageEntry('Special<Class>&', [1, 2, 3], [4])]
  },
  empty: {
    summary: { ...summary, testsRan: 0, passing: 0, failing: 0, passRate: '0%', failRate: '0%' },
    tests: []
  },
  large
} as unknown as Record<'base' | 'withCoverage' | 'special' | 'empty' | 'large', TestResult>;

export const parityFileInfos: NonNullable<OutputDirConfig['fileInfos']> = [
  { filename: 'plain.txt', content: 'plain content\r\nsecond line ü 😀' },
  {
    filename: 'obj.json',
    content: { a: 1, b: [1, 2, { c: null }], d: 'x"y', e: { f: [] }, g: undefined, h: new Date(0).toISOString() }
  },
  { filename: 'arr.json', content: [1, 'two', { three: 3 }, [4], null] },
  { filename: 'emptyobj.json', content: {} },
  { filename: 'emptyarr.json', content: [] }
];

export const parityScenarios: { name: string; result: keyof typeof parityResults; codeCoverage: boolean }[] = [
  { name: 'base-all', result: 'base', codeCoverage: false },
  { name: 'coverage-all', result: 'withCoverage', codeCoverage: true },
  { name: 'special-all', result: 'special', codeCoverage: true },
  { name: 'empty-all', result: 'empty', codeCoverage: false },
  { name: 'large-all', result: 'large', codeCoverage: true }
];

export const parityFormats: NonNullable<OutputDirConfig['resultFormats']> = [
  'json',
  'tap',
  'junit',
  'markdown',
  'text'
];
