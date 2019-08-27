/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ForceSourceDeployErrorResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as path from 'path';
import * as vscode from 'vscode';

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

export function getRange(
  lineNumber: string,
  columnNumber: string
): vscode.Range {
  const ln = Number(lineNumber);
  const col = Number(columnNumber);
  const pos = new vscode.Position(ln > 0 ? ln - 1 : 0, col > 0 ? col - 1 : 0);
  return new vscode.Range(pos, pos);
}
