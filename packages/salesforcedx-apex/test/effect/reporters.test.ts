/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Clock from 'effect/Clock';
import * as Effect from 'effect/Effect';
import { HumanReporter, JUnitReporter, MarkdownTextFormatTransformer, TapReporter } from '../../src';
import { formatHumanReport, formatJUnitReport, formatMarkdownTextReport, formatTapReport } from '../../src/effect';
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
<<<<<<< HEAD
            new HumanReporter().format(result, detailedCoverage, concise)
=======
            new HumanReporter().format(result, detailedCoverage, concise).replaceAll(/\r\n|\r|\n/g, '\n')
>>>>>>> origin/sm/W-23839447
          );
          for (const lineEnding of ['\n', '\r\n'] as const) {
            const report = await Effect.runPromise(
              formatHumanReport(result, { detailedCoverage, concise, lineEnding })
            );
            expect(report).toBe(
              new HumanReporter().format(result, detailedCoverage, concise).replaceAll(/\r\n|\r|\n/g, lineEnding)
            );
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
<<<<<<< HEAD
    ).resolves.toBe(new HumanReporter().format(coverageResultWithCategory, true, false, true));
=======
    ).resolves.toBe(
      new HumanReporter().format(coverageResultWithCategory, true, false, true).replaceAll(/\r\n|\r|\n/g, '\n')
    );
>>>>>>> origin/sm/W-23839447
    const windowsReport = await Effect.runPromise(formatHumanReport(successResult, { lineEnding: '\r\n' }));
    expect(windowsReport).toContain('\r\n\r\n');
  });

<<<<<<< HEAD
  it('defaults to non-detailed, non-concise human output with host-native line endings', async () => {
    await expect(Effect.runPromise(formatHumanReport(setupResult))).resolves.toBe(
      new HumanReporter().format(setupResult, false)
=======
  it('defaults to non-detailed, non-concise human output with LF line endings', async () => {
    await expect(Effect.runPromise(formatHumanReport(setupResult))).resolves.toBe(
      new HumanReporter().format(setupResult, false).replaceAll(/\r\n|\r|\n/g, '\n')
>>>>>>> origin/sm/W-23839447
    );
  });

  it('preserves TAP diagnostics, numbering, epilog, and final newline', async () => {
    const epilog = ['One', 'Two'];
    await expect(Effect.runPromise(formatTapReport(testResults, epilog))).resolves.toBe(
      new TapReporter().format(testResults, epilog)
    );
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

  it('preserves JUnit output against the existing fixture', async () => {
    const data = getTestData();
    await expect(Effect.runPromise(formatJUnitReport(data.testResults))).resolves.toBe(data.junitResult);
    await expect(Effect.runPromise(formatJUnitReport(data.setupResult))).resolves.toBe(data.junitSetup);
    await expect(Effect.runPromise(formatJUnitReport(data.successResult))).resolves.toBe(
      new JUnitReporter().format(data.successResult)
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
      const stream = new MarkdownTextFormatTransformer(coverageFailResult, options);
      const chunks: string[] = [];
      for await (const chunk of stream) chunks.push(String(chunk));
      await expect(Effect.runPromise(formatMarkdownTextReport(coverageFailResult, options))).resolves.toBe(
        chunks.join('')
      );
    }
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
