/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ProjectDeployStartErrorResponse } from '@salesforce/salesforcedx-utils-vscode';
import { getRootWorkspacePath } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentStatus, DeployResult } from '@salesforce/source-deploy-retrieve-bundle';
import * as path from 'path';
import * as vscode from 'vscode';
import { SfCommandletExecutor } from '../commands/util';

const notApplicable = 'N/A';

export const getFileUri = (workspacePath: string, filePath: string, defaultErrorPath: string): string => {
  const resolvedFilePath = filePath.includes(workspacePath) ? filePath : path.join(workspacePath, filePath);
  // source:deploy sometimes returns N/A as filePath
  return filePath === notApplicable ? defaultErrorPath : resolvedFilePath;
};

export const getRange = (lineNumber: string, columnNumber: string): vscode.Range => {
  const ln = Number(lineNumber);
  const col = Number(columnNumber);
  const pos = new vscode.Position(ln > 0 ? ln - 1 : 0, col > 0 ? col - 1 : 0);
  return new vscode.Range(pos, pos);
};

export const handlePushDiagnosticErrors = (
  errors: ProjectDeployStartErrorResponse,
  workspacePath: string,
  sourcePathOrPaths: string,
  errorCollection: vscode.DiagnosticCollection
): vscode.DiagnosticCollection => {
  errorCollection.clear();

  // In the case that we have deployed multiple source paths,
  // the default error path for errors without an associated
  // file path should be the workspace path
  const defaultErrorPath = sourcePathOrPaths.includes(',') ? workspacePath : sourcePathOrPaths;

  const diagnosticMap: Map<string, vscode.Diagnostic[]> = new Map();
  if (Reflect.has(errors, 'files')) {
    errors.files?.forEach(error => {
      const fileUri = getFileUri(workspacePath, error.filePath, defaultErrorPath);
      const range = getRange(error.lineNumber || '1', error.columnNumber || '1');

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
  } else if (Reflect.has(errors, 'status')) {
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
};

export const handleDeployDiagnostics = (
  deployResult: DeployResult,
  errorCollection: vscode.DiagnosticCollection
): vscode.DiagnosticCollection => {
  errorCollection.clear();
  SfCommandletExecutor.errorCollection.clear();

  const diagnosticMap: Map<string, vscode.Diagnostic[]> = new Map();

  for (const fileResponse of deployResult.getFileResponses()) {
    if (fileResponse.state !== ComponentStatus.Failed) {
      continue;
    }

    const { lineNumber, columnNumber, error, problemType, type } = fileResponse;
    const range = getRange(lineNumber ? lineNumber.toString() : '1', columnNumber ? columnNumber.toString() : '1');
    const severity = problemType === 'Error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;

    const vscDiagnostic: vscode.Diagnostic = {
      message: error,
      range,
      severity,
      source: type
    };

    const filePath = getAbsoluteFilePath(fileResponse.filePath);

    if (!diagnosticMap.has(filePath)) {
      diagnosticMap.set(filePath, []);
    }
    diagnosticMap.get(filePath)!.push(vscDiagnostic);
  }

  diagnosticMap.forEach((diagnostics, file) => errorCollection.set(vscode.Uri.file(file), diagnostics));

  return errorCollection;
};

// TODO: move to some type of file service or utility
export const getAbsoluteFilePath = (
  filePath: string | undefined,
  workspacePath: string = getRootWorkspacePath()
): string => {
  let absoluteFilePath = filePath ?? workspacePath;
  if (!absoluteFilePath.includes(workspacePath)) {
    // Build the absolute filePath so that errors in the Problems
    // tab correctly link to the problem location in the file
    absoluteFilePath = [workspacePath, filePath].join('/');
  }
  return absoluteFilePath;
};
