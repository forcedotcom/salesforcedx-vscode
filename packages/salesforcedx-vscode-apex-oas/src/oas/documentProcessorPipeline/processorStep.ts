/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { OpenAPIV3 } from 'openapi-types';
import * as vscode from 'vscode';

export type ProcessorInputOutput = {
  openAPIDoc: OpenAPIV3.Document;
  errors: vscode.Diagnostic[];
  readonly eligibleMethodNames?: readonly string[];
};

export const oasDiagnosticCollection: vscode.DiagnosticCollection =
  vscode.languages.createDiagnosticCollection('OAS Validations');
