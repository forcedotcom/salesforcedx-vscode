/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import type { ApexClassOASEligibleResponse } from 'salesforcedx-vscode-apex';
import * as vscode from 'vscode';
import { SymbolKind } from 'vscode-languageserver-protocol';
import { URI } from 'vscode-uri';
import { nls } from '../../../../src/messages/nls';
import type { ProcessorInputOutput } from '../../../../src/oas/documentProcessorPipeline/processorStep';

Object.assign(vscode, { DiagnosticSeverity: { Error: 0 } });
jest.mocked(vscode.languages.createDiagnosticCollection).mockReturnValue({
  clear: jest.fn()
} as unknown as vscode.DiagnosticCollection);

const { methodValidationStep } = jest.requireActual<
  typeof import('../../../../src/oas/documentProcessorPipeline/methodValidationStep')
>('../../../../src/oas/documentProcessorPipeline/methodValidationStep');

describe('methodValidationStep', () => {
  it('preserves source order for multiple method mismatches', async () => {
    const methodNames = ['firstMethod', 'secondMethod', 'thirdMethod', 'fourthMethod'];
    const operationIds = ['firstOperation', 'secondOperation', 'thirdOperation', 'fourthOperation'];
    const position = { line: 0, character: 0 };
    const eligibilityResult: ApexClassOASEligibleResponse = {
      resourceUri: URI.file('/test.cls'),
      isApexOasEligible: true,
      isEligible: true,
      symbols: methodNames.map(name => ({
        isApexOasEligible: true,
        isEligible: true,
        docSymbol: {
          name,
          kind: SymbolKind.Method,
          range: { start: position, end: position },
          selectionRange: { start: position, end: position }
        }
      }))
    };
    const input: ProcessorInputOutput = {
      errors: [],
      eligibilityResult,
      openAPIDoc: {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: Object.fromEntries(
          operationIds.map((operationId, index) => [`/operation-${index}`, { get: { operationId, responses: {} } }])
        )
      }
    };
    const localize = jest.spyOn(nls, 'localize');

    await Effect.runPromise(methodValidationStep(input));

    expect(localize.mock.calls).toEqual([
      ...methodNames.map(methodName => ['eligible_method_not_in_doc', methodName]),
      ...operationIds.map(operationId => ['ineligible_method_in_doc', operationId])
    ]);
  });
});
