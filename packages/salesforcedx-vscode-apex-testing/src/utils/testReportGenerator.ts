/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TestResult, MarkdownTextFormatTransformer, OutputFormat, TestSortOrder } from '@salesforce/apex-node';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../messages';
import { retrieveCoverageThreshold, retrievePerformanceThreshold } from '../settings';
import { NewlineNormalizationState, normalizeTextChunkToLf } from './newlineUtils';

/** Collects stream output into a UTF-8 encoded Uint8Array with LF line endings */
const streamToNormalizedUtf8Bytes = async (stream: NodeJS.ReadableStream): Promise<Uint8Array> => {
  const decoder = new TextDecoder('utf-8');
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];

  // Tracks a trailing '\r' from the previous decoded chunk so we can correctly normalize CRLF across boundaries.
  const state: NewlineNormalizationState = { hasTrailingCarriageReturn: false };

  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => {
      const decoded = decoder.decode(chunk, { stream: true });
      const { normalizedText: normalizedChunkText } = normalizeTextChunkToLf(decoded, state);
      if (normalizedChunkText.length > 0) {
        parts.push(encoder.encode(normalizedChunkText));
      }
    });
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });

  // Flush any final decoder state.
  const { normalizedText: normalizedTailText } = normalizeTextChunkToLf(decoder.decode(), state);
  if (normalizedTailText.length > 0) {
    parts.push(encoder.encode(normalizedTailText));
  }

  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

/** Builds the MarkdownTextFormatTransformer for the given result and settings */
const createReportTransformer = (
  result: TestResult,
  format: OutputFormat,
  codeCoverage: boolean,
  sortOrder: TestSortOrder
): MarkdownTextFormatTransformer => {
  const performanceThresholdMs = retrievePerformanceThreshold();
  const coverageThresholdPercent = retrieveCoverageThreshold();
  return new MarkdownTextFormatTransformer(result, {
    format,
    sortOrder,
    performanceThresholdMs,
    coverageThresholdPercent,
    codeCoverage,
    timestamp: new Date()
  });
};

/** Generates report URI using the library's format: test-result-{testRunId}.{ext} */
const generateReportUri = (outputDir: URI, testRunId: string | undefined, extension: string): URI => {
  const filename = testRunId ? `test-result-${testRunId}${extension}` : `test-result${extension}`;
  return Utils.joinPath(outputDir, filename);
};

/** Opens the report file in the editor (forked as a daemon so it doesn't block the caller) */
const openReportOnUserAction = Effect.fn('writeAndOpenTestReport.openReport')(function* (
  reportUri: URI,
  format: OutputFormat
) {
  const openAction = nls.localize('apex_test_report_open_action');
  const message = nls.localize('apex_test_report_ready_message', Utils.basename(reportUri));

  const selection = yield* Effect.tryPromise(() => vscode.window.showInformationMessage(message, openAction));

  if (selection !== openAction) {
    return;
  }

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

/** Writes test report to file and notifies the user when it's ready */
export const writeAndOpenTestReport = Effect.fn('writeAndOpenTestReport')(function* (
  result: TestResult,
  outputDir: URI,
  format: OutputFormat,
  codeCoverage: boolean = false,
  sortOrder: TestSortOrder = 'runtime'
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelSvc = yield* api.services.ChannelService;

  // Write directly to UTF-8 bytes (with LF newlines) without building a large intermediate string.
  const transformer = createReportTransformer(result, format, codeCoverage, sortOrder);

  // Generate filename using library's format: test-result-{testRunId}.{ext}
  const extension = format === 'markdown' ? '.md' : '.txt';
  const testRunId = result.summary?.testRunId;
  const reportUri = generateReportUri(outputDir, testRunId, extension);

  const uint8Array = yield* Effect.tryPromise(() => streamToNormalizedUtf8Bytes(transformer));
  const content = new TextDecoder('utf-8').decode(uint8Array);

  yield* api.services.FsService.safeWriteFile(reportUri, content).pipe(
    Effect.tapError(error => channelSvc.appendToChannel(`Failed to write test report: ${String(error)}`))
  );

  // Always print the report location to the Apex Testing output channel so it's easy to find later.
  yield* channelSvc.appendToChannel(nls.localize('apex_test_report_written_to_message', reportUri.toString()));

  // If markdown format, add a tip about viewing the preview
  if (format === 'markdown') {
    yield* channelSvc.appendToChannel(nls.localize('apex_test_report_markdown_preview_tip'));
  }

  // Show notification with option to open — fire-and-forget daemon fiber
  yield* openReportOnUserAction(reportUri, format).pipe(
    Effect.catchAll(error => Effect.logError(`[Test Report] Error in notification handler: ${String(error)}`)),
    Effect.forkDaemon
  );

  return reportUri;
});
