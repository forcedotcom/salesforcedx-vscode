/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { type TestResult, type OutputFormat, type TestSortOrder } from '@salesforce/apex-node';
import { FileOutput, writeResultFiles } from '@salesforce/apex-node/effect';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { type URI, Utils } from 'vscode-uri';
import { APEX_TESTING_SECTION } from '../constants';
import { nls } from '../messages';
import { fileOutputFromFsService } from '../services/fsServiceFileOutput';

/** Generates report URI using the library's format: test-result-{testRunId}.{ext} */
const generateReportUri = (outputDir: URI, testRunId: string | undefined, extension: string): URI => {
  const filename = `test-result-${testRunId ?? 'default'}${extension}`;
  return Utils.joinPath(outputDir, filename);
};

/** Opens the report file in the editor. Wired as a success-toast action's `run` callback by callers. */
export const openTestReport = Effect.fn('writeAndOpenTestReport.openReport')(function* (
  reportUri: URI,
  format: OutputFormat
) {
  if (format === 'markdown') {
    yield* Effect.tryPromise(() => vscode.commands.executeCommand('markdown.preview.refresh')).pipe(
      Effect.catchAll(() => Effect.void)
    );
    yield* Effect.tryPromise(() => vscode.commands.executeCommand('markdown.showPreview', reportUri));
  } else {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    yield* api.services.FsService.showTextDocument(reportUri, { preview: false, preserveFocus: false });
  }
});

/** Writes test report to file. Callers are responsible for notifying the user and providing action button wiring. */
export const writeAndOpenTestReport = Effect.fn('writeAndOpenTestReport')(function* (
  result: TestResult,
  outputDir: URI,
  format: OutputFormat,
  codeCoverage: boolean = false,
  sortOrder: TestSortOrder = 'runtime'
) {
  yield* Effect.annotateCurrentSpan({ outputFormat: format });
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fsService = yield* api.services.FsService;
  const channelSvc = yield* api.services.ChannelService;
  const settings = yield* api.services.SettingsService;
  const performanceThresholdMs = yield* settings.getValueOrElse(
    APEX_TESTING_SECTION,
    'testPerformanceThresholdMs',
    5000
  );
  const coverageThresholdPercent = yield* settings.getValueOrElse(
    APEX_TESTING_SECTION,
    'testCoverageThresholdPercent',
    75
  );

  yield* writeResultFiles(
    result,
    { dirPath: outputDir.toString(), resultFormats: [format] },
    {
      format,
      sortOrder,
      performanceThresholdMs,
      coverageThresholdPercent,
      codeCoverage,
      timestamp: new Date(),
      lineEnding: '\n',
      writeTestRunId: false
    }
  ).pipe(
    Effect.provideService(FileOutput, fileOutputFromFsService(fsService)),
    Effect.tapError(error => channelSvc.appendToChannel(`Failed to write test report: ${String(error)}`))
  );

  // Generate filename using library's format: test-result-{testRunId}.{ext}
  const extension = format === 'markdown' ? '.md' : '.txt';
  const testRunId = result.summary?.testRunId;
  const reportUri = generateReportUri(outputDir, testRunId, extension);

  // Always print the report location to the Apex Testing output channel so it's easy to find later.
  yield* channelSvc.appendToChannel(nls.localize('apex_test_report_written_to_message', reportUri.toString()));

  // If markdown format, add a tip about viewing the preview
  if (format === 'markdown') {
    yield* channelSvc.appendToChannel(nls.localize('apex_test_report_markdown_preview_tip'));
  }

  return reportUri;
});
