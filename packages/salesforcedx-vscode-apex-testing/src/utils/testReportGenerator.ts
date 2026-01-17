/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TestResult, MarkdownTextFormatTransformer, OutputFormat, TestSortOrder } from '@salesforce/apex-node';
import * as Effect from 'effect/Effect';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { AllServicesLayer, ExtensionProviderService } from '../services/extensionProvider';
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

/** Generates a filename using the library's format: test-result-{testRunId}.{ext} */
const generateReportFilename = (outputDir: string, testRunId: string | undefined, extension: string): string => {
  const filename = testRunId ? `test-result-${testRunId}${extension}` : `test-result${extension}`;
  return path.join(outputDir, filename);
};
/** Writes test report to file and notifies the user when it's ready */
export const writeAndOpenTestReport = async (
  result: TestResult,
  outputDir: string,
  format: OutputFormat,
  codeCoverage: boolean = false,
  sortOrder: TestSortOrder = 'runtime'
): Promise<string> => {
  // Write directly to UTF-8 bytes (with LF newlines) without building a large intermediate string.
  const transformer = createReportTransformer(result, format, codeCoverage, sortOrder);

  // Generate filename using library's format: test-result-{testRunId}.{ext}
  const extension = format === 'markdown' ? '.md' : '.txt';
  const testRunId = result.summary?.testRunId;
  const reportPath = generateReportFilename(outputDir, testRunId, extension);

  // Convert stream to UTF-8 string for FsService.writeFile
  const uint8Array = await streamToNormalizedUtf8Bytes(transformer);
  const content = new TextDecoder('utf-8').decode(uint8Array);

  // Write the file using FsService.writeFile from the services extension
  // Pass string path - FsService.writeFile handles URI conversion internally
  try {
    await Effect.runPromise(
      Effect.gen(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        const svc = yield* api.services.FsService;
        yield* svc.writeFile(reportPath, content);
      }).pipe(Effect.provide(AllServicesLayer))
    );
  } catch (error) {
    console.error('Failed to write test report file:', error);
    await channelService.appendLine(`Failed to write test report: ${String(error)}`);
    throw error;
  }

  // Create URI for opening the file
  // On desktop: use vscode.Uri.file() for proper file:// URI
  // On web: construct URI relative to workspace root for correct scheme
  const uri =
    process.env.ESBUILD_PLATFORM === 'web'
      ? vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, reportPath.replace(/^\/[^/]+/, ''))
      : vscode.Uri.file(reportPath);

  const openAction = nls.localize('apex_test_report_open_action');
  const message = nls.localize('apex_test_report_ready_message', path.basename(reportPath));
  const outputLine = nls.localize('apex_test_report_written_to_message', reportPath);

  // Always print the report location to the Apex Testing output channel so it's easy to find later.
  try {
    await channelService.appendLine(outputLine);
    // If markdown format, add a tip about viewing the preview
    if (format === 'markdown') {
      await channelService.appendLine(nls.localize('apex_test_report_markdown_preview_tip'));
    }
  } catch (error) {
    console.error('Failed to append to output channel:', error);
  }

  // Show notification with option to open the report
  void vscode.window.showInformationMessage(message, openAction).then(
    async selection => {
      if (selection === openAction) {
        // Only open the report if the user explicitly chooses to.
        try {
          if (format === 'markdown') {
            // Try to refresh the preview if it's already open (before opening a new one)
            try {
              await vscode.commands.executeCommand('markdown.preview.refresh');
            } catch {
              // Preview refresh command might not be available, ignore
            }
            // Then show the preview
            await vscode.commands.executeCommand('markdown.showPreview', uri);
          } else {
            const document = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(document, {
              preview: false,
              preserveFocus: false
            });
          }
        } catch (error) {
          console.error('Failed to open test report:', error, 'URI:', uri.toString(), 'Report path:', reportPath);
          await channelService.appendLine(
            `Failed to open test report: ${String(error)} (URI: ${uri.toString()}, Path: ${reportPath})`
          );
        }
      }
    },
    error => {
      console.error('[Test Report] Error in notification handler:', error);
    }
  );

  return reportPath;
};
