/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import * as yaml from 'yaml';
import { nls } from '../../messages';
import { ApexClassOASEligibleResponse, OpenAPIDoc } from '../schemas';
import { ProcessorInputOutput, ProcessorStep } from './processorStep';
export class MethodValidationStep implements ProcessorStep {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private className: string = '';
  private virtualUri: vscode.Uri | null = null; // the url of the virtual YAML file
  private diagnostics: vscode.Diagnostic[] = [];
  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('OAS Method Validations');
  }
  process(input: ProcessorInputOutput): Promise<ProcessorInputOutput> {
    this.className = input.context.classDetail.name;
    this.virtualUri = vscode.Uri.parse(`untitled:${this.className}_OAS_temp.yaml`);
    this.diagnosticCollection.clear();
    const cleanedupYaml = this.validateMethods(input.yaml, input.eligibilityResult);
    this.diagnosticCollection.set(this.virtualUri, this.diagnostics);
    return new Promise(resolve => {
      resolve({ ...input, yaml: cleanedupYaml });
    });
  }

  private validateMethods(doc: string, eligibilityResult: ApexClassOASEligibleResponse): string {
    const symbols = eligibilityResult.symbols;
    if (!symbols || symbols.length === 0) {
      throw new Error(nls.localize('no_eligible_method'));
    }
    const methodNames = new Set(
      symbols.filter(symbol => symbol.isApexOasEligible).map(symbol => symbol.docSymbol.name)
    );

    let parsed = null;
    try {
      parsed = yaml.parse(doc) as OpenAPIDoc;
    } catch (e) {
      this.diagnostics.push(
        new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 0),
          nls.localize('failed_to_parse_yaml', e),
          vscode.DiagnosticSeverity.Error
        )
      );
    }

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
    return doc;
  }
}
