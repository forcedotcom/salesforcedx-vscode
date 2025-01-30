/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OpenAPIV3 } from 'openapi-types';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { ApexClassOASEligibleResponse, OpenAPIDoc } from '../schemas';
import { ProcessorInputOutput, ProcessorStep } from './processorStep';
export class MethodValidationStep implements ProcessorStep {
  static diagnosticCollection: vscode.DiagnosticCollection =
    vscode.languages.createDiagnosticCollection('OAS Method Validations');
  private className: string = '';
  private virtualUri: vscode.Uri | null = null; // the url of the virtual YAML file
  private diagnostics: vscode.Diagnostic[] = [];
  constructor() {}
  process(input: ProcessorInputOutput): Promise<ProcessorInputOutput> {
    this.className = input.context.classDetail.name as string;
    this.virtualUri = vscode.Uri.parse(`untitled:${this.className}_OAS_temp.yaml`);
    MethodValidationStep.diagnosticCollection.clear();
    const cleanedupYaml = this.validateMethods(input.yaml, input.eligibilityResult);
    MethodValidationStep.diagnosticCollection.set(this.virtualUri, this.diagnostics);
    input.errors = [...input.errors, ...this.diagnostics];
    return new Promise(resolve => {
      resolve({ ...input, yaml: cleanedupYaml });
    });
  }

  private validateMethods(
    parsed: OpenAPIV3.Document,
    eligibilityResult: ApexClassOASEligibleResponse
  ): OpenAPIV3.Document {
    const symbols = eligibilityResult.symbols;
    if (!symbols || symbols.length === 0) {
      throw new Error(nls.localize('no_eligible_method'));
    }
    const methodNames = new Set(
      symbols.filter(symbol => symbol.isApexOasEligible).map(symbol => symbol.docSymbol.name)
    );

    for (const [path, methods] of Object.entries(parsed?.paths || {})) {
      const methodName = path.split('/').pop();
      // make sure all eligible methods are present in the document
      if (!methodName || !methodNames.has(methodName)) {
        this.diagnostics.push(
          new vscode.Diagnostic(
            new vscode.Range(0, 0, 0, 0),
            nls.localize('ineligible_method_in_doc', methodName),
            vscode.DiagnosticSeverity.Error
          )
        );
      } else {
        methodNames.delete(methodName);
      }
    }

    if (methodNames.size > 0) {
      this.diagnostics.push(
        new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 0),
          nls.localize('eligible_method_not_in_doc', Array.from(methodNames).join(', ')),
          vscode.DiagnosticSeverity.Error
        )
      );
    }
    return parsed;
  }
}
