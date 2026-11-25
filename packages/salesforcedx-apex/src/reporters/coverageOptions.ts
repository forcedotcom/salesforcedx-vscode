/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type * as libReport from 'istanbul-lib-report';
import type * as reports from 'istanbul-reports';

export type CoverageReportFormats = Exclude<reports.ReportType, 'lcov' | 'text-lcov'>;

export const DefaultWatermarks: libReport.Watermarks = {
  statements: [50, 75],
  functions: [50, 75],
  branches: [50, 75],
  lines: [50, 75]
};

export const DefaultReportOptions: Omit<reports.ReportOptions, 'lcov' | 'text-lcov'> = {
  clover: { file: 'clover.xml', projectRoot: '.' },
  cobertura: { file: 'cobertura.xml', projectRoot: '.' },
  'html-spa': {
    verbose: false,
    skipEmpty: false,
    subdir: 'html-spa',
    linkMapper: undefined as unknown as reports.ReportOptions['html-spa']['linkMapper'],
    metricsToShow: ['lines', 'statements', 'branches']
  },
  html: {
    verbose: false,
    skipEmpty: false,
    subdir: 'html',
    linkMapper: undefined as unknown as reports.ReportOptions['html']['linkMapper']
  },
  json: { file: 'coverage.json' },
  'json-summary': { file: 'coverage-summary.json' },
  lcovonly: { file: 'lcovonly.info', projectRoot: '.' },
  none: {} as never,
  teamcity: { file: 'teamcity.txt', blockName: 'coverage' },
  text: { file: 'text.txt', maxCols: 160, skipEmpty: false, skipFull: false },
  'text-summary': { file: 'text-summary.txt' }
};

export interface CoverageReporterOptions {
  reportFormats?: CoverageReportFormats[];
  reportOptions?: Partial<typeof DefaultReportOptions>;
  watermark?: typeof DefaultWatermarks;
}
