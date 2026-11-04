/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { nls } from '../../../../src/messages/nls';
import type { ProcessorInputOutput } from '../../../../src/oas/documentProcessorPipeline/processorStep';

Object.assign(vscode, { DiagnosticSeverity: { Error: 0 } });

describe('methodValidationStep', () => {
  it('preserves source order for multiple method mismatches', async () => {
    vi.mocked(vscode.languages.createDiagnosticCollection).mockReturnValue({
      clear: vi.fn()
    } as unknown as vscode.DiagnosticCollection);
    const { methodValidationStep } =
      await import('../../../../src/oas/documentProcessorPipeline/methodValidationStep.js');
    const methodNames = ['firstMethod', 'secondMethod', 'thirdMethod', 'fourthMethod'];
    const operationIds = ['firstOperation', 'secondOperation', 'thirdOperation', 'fourthOperation'];
    const input: ProcessorInputOutput = {
      errors: [],
      eligibleMethodNames: methodNames,
      openAPIDoc: {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: Object.fromEntries(
          operationIds.map((operationId, index) => [`/operation-${index}`, { get: { operationId, responses: {} } }])
        )
      }
    };
    const localize = vi.spyOn(nls, 'localize');

    await Effect.runPromise(methodValidationStep(input));

    expect(localize.mock.calls).toEqual([
      ...methodNames.map(methodName => ['eligible_method_not_in_doc', methodName]),
      ...operationIds.map(operationId => ['ineligible_method_in_doc', operationId])
    ]);
  });
});
