/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export { formatTap } from './tapFormatting';
export { formatJUnit } from './junitFormatting';
export { formatHuman } from './humanFormatting';
export { CoverageReporter, DefaultReportOptions, DefaultWatermarks } from './coverageReporter';
export type { CoverageReporterOptions, CoverageReportFormats } from './coverageReporter';
export type { MarkdownTextReporterOptions, OutputFormat, TestSortOrder } from './markdownTextReporter';
export { MarkdownTextFormatTransformer } from './markdownTextFormatTransformer';
export type { MarkdownTextFormatTransformerOptions } from './markdownTextFormatTransformer';
