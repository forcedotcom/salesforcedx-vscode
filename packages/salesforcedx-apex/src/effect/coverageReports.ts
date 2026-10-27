/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ApexCodeCoverage, ApexCodeCoverageAggregate } from '../tests/types';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import type * as libReport from 'istanbul-lib-report';
import type * as reports from 'istanbul-reports';
import { messages } from '../i18n/i18n';
import { createCoverageMap, type CoverageSource } from '../reporters/coverageMap';
import { DefaultReportOptions, DefaultWatermarks, type CoverageReporterOptions } from '../reporters/coverageOptions';
import { ApexReportError, causeMessage } from './errors';

/** The host supplies Istanbul and owns its writer, source lookup, and report destination. */
export class IstanbulReports extends Context.Tag('Apex.IstanbulReports')<
  IstanbulReports,
  {
    createContext: (options: Omit<libReport.ContextOptions, 'dir'>) => libReport.Context;
    createReport: typeof reports.create;
  }
>() {}

const coverageError = (cause: unknown): ApexReportError =>
  new ApexReportError({
    format: 'coverage',
    message: messages.coverageReportCreationError.replace('%s', () => causeMessage(cause)),
    cause: causeMessage(cause)
  });

export interface CoverageReportOptions extends CoverageReporterOptions {
  lineEnding?: '\n' | '\r\n';
}

export const buildCoverageMap = Effect.fn('Apex.buildCoverageMap')(
  (
    coverage: ApexCodeCoverageAggregate | ApexCodeCoverage,
    sources: Readonly<Record<string, CoverageSource>>,
    lineEnding: '\n' | '\r\n' = '\n'
  ) =>
    Effect.try({
      try: () => createCoverageMap(coverage, name => sources[name] ?? { path: name }, lineEnding),
      catch: coverageError
    })
);

/** Generates the requested reports using caller-owned Istanbul output; defaults to text-summary. */
export const generateCoverageReports = Effect.fn('Apex.generateCoverageReports')(function* (
  coverage: ApexCodeCoverageAggregate | ApexCodeCoverage,
  sources: Readonly<Record<string, CoverageSource>>,
  options?: CoverageReportOptions
) {
  const istanbul = yield* IstanbulReports;
  return yield* buildCoverageMap(coverage, sources, options?.lineEnding).pipe(
    Effect.flatMap(coverageMap =>
      Effect.try({
        try: () => {
<<<<<<< HEAD
          const sourceByPath = new Map(Object.values(sources).map(source => [source.path, source.content]));
          const sourceFinder = (path: string): string => {
            const content = sourceByPath.get(path);
            if (content === undefined) throw new Error(`Source content was not supplied for ${path}`);
            return content;
          };
          const formats = options?.reportFormats || ['text-summary'];
          // Istanbul HTML annotation catches source lookup errors instead of failing the report.
          if (formats.some(format => format === 'html' || format === 'html-spa')) {
            coverageMap.files().forEach(sourceFinder);
          }
=======
          const sourceByPath = new Map(Object.values(sources).map(source => [source.path, source.content ?? '']));
>>>>>>> origin/sm/W-23839447
          const context = istanbul.createContext({
            coverageMap,
            defaultSummarizer: 'nested',
            watermarks: options?.watermark || DefaultWatermarks,
<<<<<<< HEAD
            sourceFinder
          });
          formats.forEach(format => {
=======
            sourceFinder: path => sourceByPath.get(path) ?? ''
          });
          (options?.reportFormats || ['text-summary']).forEach(format => {
>>>>>>> origin/sm/W-23839447
            istanbul
              .createReport(format, options?.reportOptions?.[format] || DefaultReportOptions[format])
              .execute(context);
          });
        },
        catch: coverageError
      })
    )
  );
});
