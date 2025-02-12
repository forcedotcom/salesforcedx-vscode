/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { difference } from '@salesforce/salesforcedx-utils-vscode';
import { JSONPath } from 'jsonpath-plus';
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
    const mulesoftExtension = vscode.extensions.getExtension('mulesoft.mulesoft-extension-id');
    if (!mulesoftExtension || !mulesoftExtension.isActive) {
      MethodValidationStep.diagnosticCollection.set(this.virtualUri, this.diagnostics);
      input.errors = [...input.errors, ...this.diagnostics];
    }
    return new Promise(resolve => {
      resolve({ ...input, yaml: cleanedupYaml });
    });
  }

  private validateMethods(
    oasYaml: OpenAPIV3.Document,
    eligibilityResult: ApexClassOASEligibleResponse
  ): OpenAPIV3.Document {
    const symbols = eligibilityResult.symbols;
    if (!symbols || symbols.length === 0) {
      throw new Error(nls.localize('no_eligible_method'));
    }
    const methodNames = new Set<string>(
      symbols.filter(symbol => symbol.isApexOasEligible).map(symbol => symbol.docSymbol.name)
    );

    // Use JSONPath to find all operationIds in the OAS document
    const operationIds = new Set<string>(JSONPath({ path: '$..operationId', json: oasYaml }));

    difference(methodNames, operationIds).forEach(methodName => {
      this.diagnostics.push(
        new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 0),
          nls.localize('eligible_method_not_in_doc', methodName),
          vscode.DiagnosticSeverity.Error
        )
      );
    });

    difference(operationIds, methodNames).forEach(methodName => {
      this.diagnostics.push(
        new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 0),
          nls.localize('ineligible_method_in_doc', methodName),
          vscode.DiagnosticSeverity.Error
        )
      );
    });

    return oasYaml;
  }
}
