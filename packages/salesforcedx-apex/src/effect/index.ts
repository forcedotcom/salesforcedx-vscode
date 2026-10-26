/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export { ExecuteAnonymousOptionsSchema, ExecuteAnonymousResultSchema, executeAnonymous } from './executeAnonymous';
export type { ExecuteAnonymousOptions, ExecuteAnonymousResult } from './executeAnonymous';
export { ApexOperationError, ApexResponseDecodeError, ApexReportError, causeMessage } from './errors';
export { formatHumanReport, formatTapReport, formatJUnitReport, formatMarkdownTextReport } from './reporters';
export type { HumanReporterOptions } from './reporters';
export type { MarkdownTextReporterOptions, OutputFormat, TestSortOrder } from '../reporters/markdownTextReporter';
export { buildCoverageMap, generateCoverageReports, IstanbulReports } from './coverageReports';
export type { CoverageReportOptions } from './coverageReports';
export type { CoverageSource } from '../reporters/coverageMap';
export { DefaultReportOptions, DefaultWatermarks } from '../reporters/coverageOptions';
export type { CoverageReporterOptions, CoverageReportFormats } from '../reporters/coverageOptions';
