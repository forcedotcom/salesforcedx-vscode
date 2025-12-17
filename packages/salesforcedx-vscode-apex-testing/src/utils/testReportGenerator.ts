/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TestResult } from '@salesforce/apex-node';
import * as path from 'node:path';
import * as vscode from 'vscode';

export type OutputFormat = 'markdown' | 'text';

/** Escapes markdown special characters */
const escapeMarkdown = (text: string): string => text.replaceAll(/[\\`*_{}[\]()#+\-!]/g, '\\$&');

/** Formats duration in milliseconds to a human-readable string */
const formatDuration = (ms: number): string => {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
};

/** Generates a markdown report from test results */
export const generateMarkdownReport = (result: TestResult, timestamp: Date): string => {
  const summary = result.summary;
  const passed = summary?.passing ?? 0;
  const failed = summary?.failing ?? 0;
  const skipped = summary?.skipped ?? 0;
  const total = summary?.testsRan ?? 0;
  const duration =
    summary?.outcome === 'Passed' || summary?.outcome === 'Failed' ? (summary?.testExecutionTimeInMs ?? 0) : 0;

  const timestampStr = timestamp.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  let report = '# Apex Test Results\n\n';
  report += `**Run completed:** ${timestampStr}\n\n`;

  // Summary table
  report += '## Summary\n\n';
  report += '| Status | Count |\n';
  report += '|--------|-------|\n';
  report += `| ✅ Passed | ${passed} |\n`;
  report += `| ❌ Failed | ${failed} |\n`;
  report += `| ⏭️ Skipped | ${skipped} |\n`;
  report += `| **Total** | **${total}** |\n`;
  report += `| **Duration** | ${formatDuration(duration)} |\n\n`;

  // Failures section
  const failedTests = result.tests?.filter(test => test.outcome?.toString() === 'Fail') ?? [];
  if (failedTests.length > 0) {
    report += '## ❌ Failures\n\n';
    for (const test of failedTests) {
      const className = test.apexClass?.name ?? 'Unknown';
      const namespacePrefix = test.apexClass?.namespacePrefix;
      const fullClassName = namespacePrefix ? `${namespacePrefix}.${className}` : className;
      const methodName = test.methodName ?? 'Unknown';
      const testName = `${fullClassName}.${methodName}`;

      report += `### ${escapeMarkdown(testName)}\n\n`;
      if (test.message) {
        report += '**Error:**\n\n';
        report += `\`\`\`\n${test.message}\n\`\`\`\n\n`;
      }
      if (test.stackTrace) {
        report += '**Stack Trace:**\n\n';
        report += `\`\`\`\n${test.stackTrace}\n\`\`\`\n\n`;
      }
      if (test.runTime !== undefined) {
        report += `**Duration:** ${formatDuration(test.runTime)}\n\n`;
      }
      report += '---\n\n';
    }
  }

  // Passed tests section
  const passedTests = result.tests?.filter(test => test.outcome?.toString() === 'Pass') ?? [];
  if (passedTests.length > 0) {
    report += '## ✅ Passed Tests\n\n';
    for (const test of passedTests) {
      const className = test.apexClass?.name ?? 'Unknown';
      const namespacePrefix = test.apexClass?.namespacePrefix;
      const fullClassName = namespacePrefix ? `${namespacePrefix}.${className}` : className;
      const methodName = test.methodName ?? 'Unknown';
      const testName = `${fullClassName}.${methodName}`;

      report += `- ${escapeMarkdown(testName)}`;
      if (test.runTime !== undefined) {
        report += ` (${formatDuration(test.runTime)})`;
      }
      report += '\n';
    }
    report += '\n';
  }

  // Skipped tests section
  const skippedTests = result.tests?.filter(test => test.outcome?.toString() === 'Skip') ?? [];
  if (skippedTests.length > 0) {
    report += '## ⏭️ Skipped Tests\n\n';
    for (const test of skippedTests) {
      const className = test.apexClass?.name ?? 'Unknown';
      const namespacePrefix = test.apexClass?.namespacePrefix;
      const fullClassName = namespacePrefix ? `${namespacePrefix}.${className}` : className;
      const methodName = test.methodName ?? 'Unknown';
      const testName = `${fullClassName}.${methodName}`;

      report += `- ${escapeMarkdown(testName)}\n`;
    }
    report += '\n';
  }

  return report;
};

/** Generates a plain text report from test results */
export const generateTextReport = (result: TestResult, timestamp: Date): string => {
  const summary = result.summary;
  const passed = summary?.passing ?? 0;
  const failed = summary?.failing ?? 0;
  const skipped = summary?.skipped ?? 0;
  const total = summary?.testsRan ?? 0;
  const duration =
    summary?.outcome === 'Passed' || summary?.outcome === 'Failed' ? (summary?.testExecutionTimeInMs ?? 0) : 0;

  const timestampStr = timestamp.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  let report = 'Apex Test Results\n';
  report += '==================\n\n';
  report += `Run completed: ${timestampStr}\n\n`;

  // Summary
  report += 'Summary:\n';
  report += `  Passed:  ${passed}\n`;
  report += `  Failed:  ${failed}\n`;
  report += `  Skipped: ${skipped}\n`;
  report += `  Total:   ${total}\n`;
  report += `  Duration: ${formatDuration(duration)}\n\n`;

  // Failures section
  const failedTests = result.tests?.filter(test => test.outcome?.toString() === 'Fail') ?? [];
  if (failedTests.length > 0) {
    report += 'Failures:\n';
    report += '=========\n\n';
    for (const test of failedTests) {
      const className = test.apexClass?.name ?? 'Unknown';
      const namespacePrefix = test.apexClass?.namespacePrefix;
      const fullClassName = namespacePrefix ? `${namespacePrefix}.${className}` : className;
      const methodName = test.methodName ?? 'Unknown';
      const testName = `${fullClassName}.${methodName}`;

      report += `${testName}\n`;
      report += `${'-'.repeat(testName.length)}\n`;
      if (test.message) {
        report += `Error:\n${test.message}\n\n`;
      }
      if (test.stackTrace) {
        report += `Stack Trace:\n${test.stackTrace}\n\n`;
      }
      if (test.runTime !== undefined) {
        report += `Duration: ${formatDuration(test.runTime)}\n\n`;
      }
      report += '\n';
    }
  }

  // Passed tests section
  const passedTests = result.tests?.filter(test => test.outcome?.toString() === 'Pass') ?? [];
  if (passedTests.length > 0) {
    report += 'Passed Tests:\n';
    report += '==============\n\n';
    for (const test of passedTests) {
      const className = test.apexClass?.name ?? 'Unknown';
      const namespacePrefix = test.apexClass?.namespacePrefix;
      const fullClassName = namespacePrefix ? `${namespacePrefix}.${className}` : className;
      const methodName = test.methodName ?? 'Unknown';
      const testName = `${fullClassName}.${methodName}`;

      report += `  - ${testName}`;
      if (test.runTime !== undefined) {
        report += ` (${formatDuration(test.runTime)})`;
      }
      report += '\n';
    }
    report += '\n';
  }

  // Skipped tests section
  const skippedTests = result.tests?.filter(test => test.outcome?.toString() === 'Skip') ?? [];
  if (skippedTests.length > 0) {
    report += 'Skipped Tests:\n';
    report += '===============\n\n';
    for (const test of skippedTests) {
      const className = test.apexClass?.name ?? 'Unknown';
      const namespacePrefix = test.apexClass?.namespacePrefix;
      const fullClassName = namespacePrefix ? `${namespacePrefix}.${className}` : className;
      const methodName = test.methodName ?? 'Unknown';
      const testName = `${fullClassName}.${methodName}`;

      report += `  - ${testName}\n`;
    }
    report += '\n';
  }

  return report;
};

/** Writes test report to file and opens it in editor */
export const writeAndOpenTestReport = async (
  result: TestResult,
  outputDir: string,
  format: OutputFormat
): Promise<string> => {
  const timestamp = new Date();
  const reportContent =
    format === 'markdown' ? generateMarkdownReport(result, timestamp) : generateTextReport(result, timestamp);

  // Use last-run.md/txt as the filename (will be overwritten on each run)
  const extension = format === 'markdown' ? '.md' : '.txt';
  const reportPath = path.join(outputDir, `last-run${extension}`);

  // Ensure content uses LF line endings (UTF-8 with LF)
  const normalizedContent = reportContent.replaceAll('\r\n', '\n').replaceAll('\r', '\n');

  // Write file using vscode.workspace.fs
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(normalizedContent);
  const uri = vscode.Uri.file(reportPath);
  await vscode.workspace.fs.writeFile(uri, uint8Array);

  // Open the file in editor (note: VS Code doesn't support programmatically making documents read-only,
  // but the file will be overwritten on the next test run, so edits will be lost)
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document, {
    preview: false,
    preserveFocus: false
  });

  return reportPath;
};
