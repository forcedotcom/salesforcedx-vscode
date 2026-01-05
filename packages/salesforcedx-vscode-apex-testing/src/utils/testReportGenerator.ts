/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  TestResult,
  MarkdownTextReporter,
  OutputFormat,
  TestSortOrder,
  MarkdownTextReporterOptions
} from '@salesforce/apex-node';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { retrieveCoverageThreshold, retrievePerformanceThreshold } from '../settings';

/** Generates a markdown or text report from test results using the MarkdownTextReporter */
const generateReport = (
  result: TestResult,
  format: OutputFormat,
  codeCoverage: boolean,
  sortOrder: TestSortOrder
): string => {
  // Retrieve thresholds from settings
  const performanceThresholdMs = retrievePerformanceThreshold();
  const coverageThresholdPercent = retrieveCoverageThreshold();

  const options: MarkdownTextReporterOptions = {
    format,
    sortOrder,
    performanceThresholdMs,
    coverageThresholdPercent,
    codeCoverage,
    timestamp: new Date()
  };

  const reporter = new MarkdownTextReporter(options);
  return reporter.format(result);
};

/** Generates a filename with timestamp to preserve previous runs */
const generateReportFilename = (outputDir: string, extension: string): string => {
  const timestamp = new Date();
  const year = timestamp.getFullYear();
  const month = String(timestamp.getMonth() + 1).padStart(2, '0');
  const day = String(timestamp.getDate()).padStart(2, '0');
  const hour = String(timestamp.getHours()).padStart(2, '0');
  const minute = String(timestamp.getMinutes()).padStart(2, '0');
  const second = String(timestamp.getSeconds()).padStart(2, '0');
  const timestampStr = `${year}${month}${day}-${hour}${minute}${second}`;
  return path.join(outputDir, `test-results-${timestampStr}${extension}`);
};

/** Writes test report to file and opens it in editor */
export const writeAndOpenTestReport = async (
  result: TestResult,
  outputDir: string,
  format: OutputFormat,
  codeCoverage: boolean = false,
  sortOrder: TestSortOrder = 'runtime'
): Promise<string> => {
  const reportContent = generateReport(result, format, codeCoverage, sortOrder);

  // Generate filename with timestamp to preserve previous runs
  const extension = format === 'markdown' ? '.md' : '.txt';
  const reportPath = generateReportFilename(outputDir, extension);

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
