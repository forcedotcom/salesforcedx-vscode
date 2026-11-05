/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Clock from 'effect/Clock';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import { formatHuman, formatJUnit, formatTap } from '../../src';
import {
  formatHumanReport,
  formatJUnitReport,
  formatMarkdownTextReport,
  formatMarkdownTextReportStream,
  formatTapReport
} from '../../src/effect';
import type { MarkdownTextReporterOptions } from '../../src/reporters/markdownTextReporter';
import {
  coverageFailResult,
  coverageResultWithCategory,
  getTestData,
  setupResult,
  successResult,
  testResults
} from '../reporters/testResults';

const timestamp = new Date('2026-01-02T03:04:05Z');

describe('Effect reporters', () => {
  it.each([successResult, testResults, coverageFailResult, setupResult])(
    'preserves human output and flags',
    async result => {
      for (const detailedCoverage of [false, true]) {
        for (const concise of [false, true]) {
          await expect(Effect.runPromise(formatHumanReport(result, { detailedCoverage, concise }))).resolves.toBe(
            formatHuman(result, detailedCoverage, concise)
          );
          for (const lineEnding of ['\n', '\r\n'] as const) {
            const report = await Effect.runPromise(
              formatHumanReport(result, { detailedCoverage, concise, lineEnding })
            );
            expect(report).toBe(formatHuman(result, detailedCoverage, concise).replaceAll(/\r\n|\r|\n/g, lineEnding));
            expect(report.replaceAll(lineEnding, '')).not.toMatch(/[\r\n]/);
          }
        }
      }
    }
  );

  it('preserves category columns and caller-selected line endings', async () => {
    await expect(
      Effect.runPromise(
        formatHumanReport(coverageResultWithCategory, {
          showCategory: true,
          detailedCoverage: true
        })
      )
    ).resolves.toBe(formatHuman(coverageResultWithCategory, true, false, true));
    const windowsReport = await Effect.runPromise(formatHumanReport(successResult, { lineEnding: '\r\n' }));
    expect(windowsReport).toContain('\r\n\r\n');
  });

  it('defaults to non-detailed, non-concise human output with host-native line endings', async () => {
    await expect(Effect.runPromise(formatHumanReport(setupResult))).resolves.toBe(formatHuman(setupResult, false));
  });

  it('preserves TAP diagnostics, numbering, epilog, and final newline', async () => {
    const epilog = ['One', 'Two'];
    await expect(Effect.runPromise(formatTapReport(testResults, epilog))).resolves.toBe(formatTap(testResults, epilog));
    await expect(Effect.runPromise(formatTapReport({ ...testResults, tests: [] }))).resolves.toBe('1..0\n');
  });

  it.each(['\n', '\r\n'])('normalizes %j TAP stack traces for LF and CRLF output', async inputLineEnding => {
    const result = {
      ...testResults,
      tests: [
        {
          ...testResults.tests[0],
          outcome: 'Fail' as const,
          message: 'failure',
          stackTrace: `first${inputLineEnding}second`
        }
      ]
    };
    for (const lineEnding of [undefined, '\n', '\r\n'] as const) {
      await expect(Effect.runPromise(formatTapReport(result, ['One', 'Two'], lineEnding))).resolves.toBe(
        ['1..1', `not ok 1 ${result.tests[0].fullName}`, '# failure', '# first', '# second', '# One', '# Two', ''].join(
          lineEnding ?? '\n'
        )
      );
    }
  });

  it('preserves JUnit output against the supported formatter', async () => {
    const data = getTestData();
    await expect(Effect.runPromise(formatJUnitReport(data.testResults))).resolves.toBe(formatJUnit(data.testResults));
    await expect(Effect.runPromise(formatJUnitReport(data.setupResult))).resolves.toBe(formatJUnit(data.setupResult));
    await expect(Effect.runPromise(formatJUnitReport(data.successResult))).resolves.toBe(
      formatJUnit(data.successResult)
    );
  });

  it.each(['markdown', 'text'] as const)('preserves %s output, thresholds, coverage, and sorting', async format => {
    for (const sortOrder of ['runtime', 'coverage', 'severity'] as const) {
      const options: MarkdownTextReporterOptions = {
        format,
        sortOrder,
        codeCoverage: true,
        performanceThresholdMs: 50,
        coverageThresholdPercent: 90,
        timestamp
      };
      const streamedReport = await Effect.runPromise(
        formatMarkdownTextReportStream(coverageFailResult, options).pipe(
          Effect.flatMap(Stream.runCollect),
          Effect.map(Chunk.join(''))
        )
      );
      await expect(Effect.runPromise(formatMarkdownTextReport(coverageFailResult, options))).resolves.toBe(
        streamedReport
      );
    }
  });

  it('normalizes embedded error newlines to the requested line ending', async () => {
    const result = structuredClone(coverageFailResult);
    result.tests = result.tests.map(test =>
      test.outcome === 'Fail' ? { ...test, message: 'first\r\nsecond\rthird\n' } : test
    );
    const report = await Effect.runPromise(
      formatMarkdownTextReport(result, { format: 'text', timestamp, lineEnding: '\r\n' })
    );

    expect(report).toContain('first\r\nsecond\r\nthird\r\n');
    expect(report.replaceAll('\r\n', '')).not.toContain('\n');
    expect(report.replaceAll('\r\n', '')).not.toContain('\r');
  });

  it('uses the Effect clock for the default Markdown timestamp and preserves defaults', async () => {
    const clock = Object.assign(Clock.make(), { currentTimeMillis: Effect.succeed(timestamp.getTime()) });
    const actual = await Effect.runPromise(formatMarkdownTextReport(successResult).pipe(Effect.withClock(clock)));
    const explicit = await Effect.runPromise(
      formatMarkdownTextReport(successResult, {
        timestamp,
        format: 'markdown',
        sortOrder: 'runtime',
        performanceThresholdMs: 5000,
        coverageThresholdPercent: 75,
        codeCoverage: false
      })
    );
    expect(actual).toBe(explicit);
  });

  it('reports formatter exceptions through the typed error channel, lazily', async () => {
    const result = structuredClone(successResult);
    Object.defineProperty(result.summary, 'outcome', {
      get: () => {
        throw new Error('bad summary');
      }
    });
    const report = formatHumanReport(result);
    await expect(Effect.runPromise(Effect.flip(report))).resolves.toMatchObject({
      _tag: 'ApexReportError',
      format: 'human',
      message: 'bad summary',
      cause: 'bad summary'
    });
  });
});
