/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { JSONPath } from 'jsonpath-plus';
import type { OpenAPIV3 } from 'openapi-types';
import * as vscode from 'vscode';
import { nls } from '../../messages/nls';
import { ApexClassOASEligibleResponse } from '../schemas';
import { ProcessorInputOutput, ProcessorStep } from './processorStep';

const methodValidationDiagnosticCollection: vscode.DiagnosticCollection =
  vscode.languages.createDiagnosticCollection('OAS Method Validations');

const validateMethods = (
  oasYaml: OpenAPIV3.Document,
  eligibilityResult: ApexClassOASEligibleResponse,
  diagnostics: vscode.Diagnostic[]
): OpenAPIV3.Document => {
  const symbols = eligibilityResult.symbols;
  if (!symbols || symbols.length === 0) {
    throw new Error(nls.localize('no_eligible_method'));
  }
  const methodNames = new Set<string>(
    symbols.filter(symbol => symbol.isApexOasEligible).map(symbol => symbol.docSymbol.name)
  );

  // Use JSONPath to find all operationIds in the OAS document
  const operationIds = new Set<string>(JSONPath({ path: '$..operationId', json: oasYaml }));

  methodNames.difference(operationIds).forEach(methodName => {
    diagnostics.push(
      new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        nls.localize('eligible_method_not_in_doc', methodName),
        vscode.DiagnosticSeverity.Error
      )
    );
  });

  operationIds.difference(methodNames).forEach(methodName => {
    diagnostics.push(
      new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        nls.localize('ineligible_method_in_doc', methodName),
        vscode.DiagnosticSeverity.Error
      )
    );
  });

  return oasYaml;
};

export const methodValidationStep: ProcessorStep & { diagnosticCollection: vscode.DiagnosticCollection } = {
  diagnosticCollection: methodValidationDiagnosticCollection,
  process: (input: ProcessorInputOutput): Promise<ProcessorInputOutput> => {
    if (!input.eligibilityResult) {
      console.log('skipping methodValidationStep as no eligibility results passed');
      return Promise.resolve(input);
    }

    methodValidationDiagnosticCollection.clear();
    const diagnostics: vscode.Diagnostic[] = [];
    const cleanedupYaml = validateMethods(input.openAPIDoc, input.eligibilityResult, diagnostics);
    input.errors = [...input.errors, ...diagnostics];
    return Promise.resolve({ ...input, openAPIDoc: cleanedupYaml });
  }
};
