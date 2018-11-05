/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ForceSourceDeployErrorResult } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as path from 'path';
import * as vscode from 'vscode';

export function handleDiagnosticErrors(
  errors: ForceSourceDeployErrorResult,
  workspacePath: string,
  sourcePath: string,
  errorCollection: vscode.DiagnosticCollection
): vscode.DiagnosticCollection {
  errorCollection.clear();
  const diagnosticMap: Map<string, vscode.Diagnostic[]> = new Map();
  if (errors.hasOwnProperty('result')) {
    errors.result.forEach(error => {
      // source:deploy sometimes returns N/A as filePath
      const fileUri =
        error.filePath === 'N/A'
          ? sourcePath
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
    const fileUri = vscode.Uri.file(sourcePath);
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
  const ln = Number(lineNumber) - 1;
  const col = Number(columnNumber) - 1;
  return new vscode.Range(
    new vscode.Position(ln, col),
    new vscode.Position(ln, col)
  );
}
