/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExecuteAnonymousResponse } from '@salesforce/salesforcedx-apex/packages/apex/lib';
import { ForceSourceDeployErrorResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { DeployResult } from '@salesforce/source-deploy-retrieve';
import * as path from 'path';
import * as vscode from 'vscode';

export function getRange(
  lineNumber: string,
  columnNumber: string
): vscode.Range {
  const ln = Number(lineNumber);
  const col = Number(columnNumber);
  const pos = new vscode.Position(ln > 0 ? ln - 1 : 0, col > 0 ? col - 1 : 0);
  return new vscode.Range(pos, pos);
}

export function handleDiagnosticErrors(
  errors: ForceSourceDeployErrorResponse,
  workspacePath: string,
  sourcePathOrPaths: string,
  errorCollection: vscode.DiagnosticCollection
): vscode.DiagnosticCollection {
  errorCollection.clear();

  // In the case that we have deployed multiple source paths,
  // the default error path for errors without an associated
  // file path should be the workspace path
  const defaultErrorPath = sourcePathOrPaths.includes(',')
    ? workspacePath
    : sourcePathOrPaths;
  const diagnosticMap: Map<string, vscode.Diagnostic[]> = new Map();
  if (errors.hasOwnProperty('result')) {
    errors.result.forEach(error => {
      // source:deploy sometimes returns N/A as filePath
      const fileUri =
        error.filePath === 'N/A'
          ? defaultErrorPath
          : path.join(workspacePath, error.filePath);
      const range = getRange(
        error.lineNumber || '1',
        error.columnNumber || '1'
      );

      const diagnostic = {
        message: error.error,
        severity: vscode.DiagnosticSeverity.Error,
        source: error.type,
        range
      } as vscode.Diagnostic;

      if (!diagnosticMap.has(fileUri)) {
        diagnosticMap.set(fileUri, []);
      }

      diagnosticMap.get(fileUri)!.push(diagnostic);
    });

    diagnosticMap.forEach((diagMap: vscode.Diagnostic[], file) => {
      const fileUri = vscode.Uri.file(file);
      errorCollection.set(fileUri, diagMap);
    });
  } else if (errors.hasOwnProperty('message')) {
    const fileUri = vscode.Uri.file(defaultErrorPath);
    const range = getRange('1', '1');
    const diagnostic = {
      message: errors.message,
      severity: vscode.DiagnosticSeverity.Error,
      source: errors.name,
      range
    } as vscode.Diagnostic;

    errorCollection.set(fileUri, [diagnostic]);
  }

  return errorCollection;
}

export function handleSDRLibraryDiagnostics(
  deployResult: DeployResult,
  errorCollection: vscode.DiagnosticCollection
): vscode.DiagnosticCollection {
  errorCollection.clear();
  const diagnosticMap: Map<string, vscode.Diagnostic[]> = new Map();

  deployResult.DeployDetails!.componentFailures.forEach(err => {
    const range = getRange(
      err.lineNumber ? err.lineNumber.toString() : '1',
      err.columnNumber ? err.columnNumber.toString() : '1'
    );

    const diagnostic = {
      message: err.problem,
      severity: vscode.DiagnosticSeverity.Error,
      source: err.fileName,
      range
    } as vscode.Diagnostic;

    // NOTE: This is a workaround while we fix DeployResults not providing full
    // path info
    const fileUri = deployResult.metadataFile.replace('-meta.xml', '');

    if (!diagnosticMap.has(fileUri)) {
      diagnosticMap.set(fileUri, []);
    }

    diagnosticMap.get(fileUri)!.push(diagnostic);
  });

  diagnosticMap.forEach((diagMap: vscode.Diagnostic[], file) => {
    const fileUri = vscode.Uri.file(file);
    errorCollection.set(fileUri, diagMap);
  });

  return errorCollection;
}

export function handleApexLibraryDiagnostics(
  apexResult: ExecuteAnonymousResponse,
  errorCollection: vscode.DiagnosticCollection,
  filePath: string
) {
  errorCollection.clear();
  const diagnosticMap: Map<string, vscode.Diagnostic[]> = new Map();
  const range = getRange(
    apexResult.result.line ? apexResult.result.line.toString() : '1',
    apexResult.result.column ? apexResult.result.column.toString() : '1'
  );

  const diagnostic = {
    message:
      apexResult.result.compileProblem || apexResult.result.exceptionMessage,
    severity: vscode.DiagnosticSeverity.Error,
    source: filePath,
    range
  } as vscode.Diagnostic;
}
