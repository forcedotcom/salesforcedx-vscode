/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ProcessorInputOutput } from './processorStep';
import * as Effect from 'effect/Effect';
import { JSONPath } from 'jsonpath-plus';
import type { OpenAPIV3 } from 'openapi-types';
import type { ApexClassOASEligibleResponse } from 'salesforcedx-vscode-apex';
import * as vscode from 'vscode';
import { OasValidationFailed } from '../../errors';
import { nls } from '../../messages/nls';

const methodValidationDiagnosticCollection: vscode.DiagnosticCollection =
  vscode.languages.createDiagnosticCollection('OAS Method Validations');

const collectMethodMismatches = (
  oasYaml: OpenAPIV3.Document,
  eligibilityResult: ApexClassOASEligibleResponse
): vscode.Diagnostic[] => {
  const symbols = eligibilityResult.symbols ?? [];
  const methodNames = new Set<string>(
    symbols.filter(symbol => symbol.isApexOasEligible).map(symbol => symbol.docSymbol.name)
  );
  // Use JSONPath to find all operationIds in the OAS document
  const operationIds = new Set<string>(JSONPath({ path: '$..operationId', json: oasYaml }));

  const missingFromDoc = Array.from(methodNames.difference(operationIds)).map(
    methodName =>
      new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        nls.localize('eligible_method_not_in_doc', methodName),
        vscode.DiagnosticSeverity.Error
      )
  );
  const ineligibleInDoc = Array.from(operationIds.difference(methodNames)).map(
    methodName =>
      new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        nls.localize('ineligible_method_in_doc', methodName),
        vscode.DiagnosticSeverity.Error
      )
  );
  return [...missingFromDoc, ...ineligibleInDoc];
};

export const methodValidationStep = Effect.fn('ApexOas.Process.methodValidation')(function* (
  input: ProcessorInputOutput
) {
  if (!input.eligibilityResult) {
    yield* Effect.logDebug('skipping methodValidationStep as no eligibility results passed');
    return input;
  }
  const symbols = input.eligibilityResult.symbols ?? [];
  if (symbols.length === 0) {
    return yield* new OasValidationFailed({ message: nls.localize('no_eligible_method') });
  }
  methodValidationDiagnosticCollection.clear();
  const diagnostics = collectMethodMismatches(input.openAPIDoc, input.eligibilityResult);
  return { ...input, errors: [...input.errors, ...diagnostics] };
});
