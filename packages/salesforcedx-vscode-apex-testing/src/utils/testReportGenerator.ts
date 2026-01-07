/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TestResult, MarkdownTextFormatTransformer, OutputFormat, TestSortOrder } from '@salesforce/apex-node';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { retrieveCoverageThreshold, retrievePerformanceThreshold } from '../settings';

/** Collects stream output into a string */
const streamToString = async (stream: NodeJS.ReadableStream): Promise<string> => {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stream.on('error', reject);
  });
};

/** Generates a markdown or text report from test results using the MarkdownTextFormatTransformer */
const generateReport = async (
  result: TestResult,
  format: OutputFormat,
  codeCoverage: boolean,
  sortOrder: TestSortOrder
): Promise<string> => {
  // Retrieve thresholds from settings
  const performanceThresholdMs = retrievePerformanceThreshold();
  const coverageThresholdPercent = retrieveCoverageThreshold();

  const transformer = new MarkdownTextFormatTransformer(result, {
    format,
    sortOrder,
    performanceThresholdMs,
    coverageThresholdPercent,
    codeCoverage,
    timestamp: new Date()
  });

  return streamToString(transformer);
};

/** Generates a filename using the library's format: test-result-{testRunId}.{ext} */
const generateReportFilename = (outputDir: string, testRunId: string | undefined, extension: string): string => {
  const filename = testRunId ? `test-result-${testRunId}${extension}` : `test-result${extension}`;
  return path.join(outputDir, filename);
};

/** Writes test report to file and opens it in editor */
export const writeAndOpenTestReport = async (
  result: TestResult,
  outputDir: string,
  format: OutputFormat,
  codeCoverage: boolean = false,
  sortOrder: TestSortOrder = 'runtime'
): Promise<string> => {
  const reportContent = await generateReport(result, format, codeCoverage, sortOrder);

  // Generate filename using library's format: test-result-{testRunId}.{ext}
  const extension = format === 'markdown' ? '.md' : '.txt';
  const testRunId = result.summary?.testRunId;
  const reportPath = generateReportFilename(outputDir, testRunId, extension);

  // Ensure content uses LF line endings (UTF-8 with LF)
  const normalizedContent = reportContent.replaceAll('\r\n', '\n').replaceAll('\r', '\n');

  // Write file using vscode.workspace.fs
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(normalizedContent);
  const uri = vscode.Uri.file(reportPath);
  await vscode.workspace.fs.writeFile(uri, uint8Array);

  // Open the markdown preview automatically for markdown files
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
    // For text files, just open the document
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document, {
      preview: false,
      preserveFocus: false
    });
  }

  return reportPath;
};
