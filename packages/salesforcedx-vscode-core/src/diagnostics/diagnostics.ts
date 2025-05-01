/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { fixupError, ProjectDeployStartErrorResponse } from '@salesforce/salesforcedx-utils-vscode';
import { getRootWorkspacePath } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentStatus, DeployResult } from '@salesforce/source-deploy-retrieve-bundle';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
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

  const defaultErrorPath = sourcePathOrPaths.includes(',') ? workspacePath : sourcePathOrPaths;

  const diagnosticMap: Map<string, vscode.Diagnostic[]> = new Map();

  const processError = (filePath: string, lineNumber: string, columnNumber: string, error: string, type: string) => {
    const fileUri = getFileUri(workspacePath, filePath, defaultErrorPath);
    const range = getRange(lineNumber || '1', columnNumber || '1');

    const diagnostic: vscode.Diagnostic = {
      message: fixupError(error),
      severity: vscode.DiagnosticSeverity.Error,
      source: type,
      range
    };

    if (!diagnosticMap.has(fileUri)) {
      diagnosticMap.set(fileUri, []);
    }

    diagnosticMap.get(fileUri)!.push(diagnostic);
  };

  if (Reflect.has(errors, 'files')) {
    errors.files?.forEach(error => {
      processError(
        error.filePath ?? notApplicable,
        error.lineNumber ?? '1',
        error.columnNumber ?? '1',
        error.error ?? 'Unknown error',
        error.type ?? 'Unknown type'
      );
    });
  } else if (Reflect.has(errors, 'status')) {
    processError(defaultErrorPath, '1', '1', errors.message, errors.name);
  }

  handleDuplicateDiagnostics(diagnosticMap).forEach((diagMap: vscode.Diagnostic[], file) => {
    const fileUri = URI.file(file);
    errorCollection.set(fileUri, diagMap);
  });

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
      message: fixupError(error),
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

  handleDuplicateDiagnostics(diagnosticMap).forEach((diagMap: vscode.Diagnostic[], file) => {
    const fileUri = URI.file(file);
    errorCollection.set(fileUri, diagMap);
  });

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

const handleDuplicateDiagnostics = (
  diagnosticMap: Map<string, vscode.Diagnostic[]>
): Map<string, vscode.Diagnostic[]> => {
  diagnosticMap.forEach((diagnostics, file) => {
    const fileUri = URI.file(file);
    const existingDiagnostics = vscode.languages.getDiagnostics(fileUri);
    const existingDiagnosticKeys = new Set(existingDiagnostics.map(d => d.message));
    diagnostics.forEach((diagnostic, index) => {
      if (existingDiagnosticKeys.has(diagnostic.message)) {
        delete diagnostics[index];
      } else {
        existingDiagnosticKeys.add(diagnostic.message);
      }
    });
  });
  return diagnosticMap;
};
