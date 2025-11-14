/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { fixupError, getRootWorkspacePath } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentStatus, DeployResult } from '@salesforce/source-deploy-retrieve';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { SfCommandletExecutor } from '../commands/util';

const getRange = (lineNumber = 1, columnNumber = 1): vscode.Range => {
  const pos = new vscode.Position(lineNumber > 0 ? lineNumber - 1 : 0, columnNumber > 0 ? columnNumber - 1 : 0);
  return new vscode.Range(pos, pos);
};

export const handleDeployDiagnostics = (
  deployResult: DeployResult,
  errorCollection: vscode.DiagnosticCollection
): vscode.DiagnosticCollection => {
  errorCollection.clear();
  SfCommandletExecutor.errorCollection.clear();

  const diagnosticMap: Map<string, vscode.Diagnostic[]> = new Map();

  for (const fileResponse of deployResult.getFileResponses().filter(fr => fr.state === ComponentStatus.Failed)) {
    const { lineNumber, columnNumber, error, problemType, type } = fileResponse;
    const range = getRange(lineNumber, columnNumber);
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
