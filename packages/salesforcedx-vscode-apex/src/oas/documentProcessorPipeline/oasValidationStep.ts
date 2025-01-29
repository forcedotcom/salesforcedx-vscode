/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Spectral } from '@stoplight/spectral-core';
import * as vscode from 'vscode';
import { stringify } from 'yaml';
import { ProcessorInputOutput, ProcessorStep } from './processorStep';
import ruleset from './ruleset.spectral';

export class OasValidationStep implements ProcessorStep {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private className: string;

  constructor(className: string) {
    // Initialize a diagnostic collection for in-memory YAML validation
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('OAS Validations');
    this.className = className;
  }

  async process(input: ProcessorInputOutput): Promise<ProcessorInputOutput> {
    const spectral = new Spectral();
    spectral.setRuleset(ruleset);

    // Create a virtual URI to represent the YAML
    const virtualUri = vscode.Uri.parse(`untitled:${this.className}_OAS_temp.yaml`);
    this.diagnosticCollection.clear();

    // Run validation using Spectral
    await spectral.run(stringify(input.yaml)).then(results => {
      const diagnostics: vscode.Diagnostic[] = results.map(result => {
        const range = new vscode.Range(
          result.range.start.line,
          result.range.start.character,
          result.range.end.line,
          result.range.end.character
        );

        return new vscode.Diagnostic(range, result.message, this.mapSeverity(result.severity));
      });

      // Add diagnostics to the Problems tab for the virtual document
      this.diagnosticCollection.set(virtualUri, diagnostics);
      input.errors = [...input.errors, ...diagnostics];
    });

    // Return the input for future processing
    return input;
  }

  private mapSeverity(severity: number): vscode.DiagnosticSeverity {
    switch (severity) {
      case 0:
        return vscode.DiagnosticSeverity.Error; // Spectral severity 0 = Error
      case 1:
        return vscode.DiagnosticSeverity.Warning; // Spectral severity 1 = Warning
      case 2:
        return vscode.DiagnosticSeverity.Information; // Spectral severity 2 = Info
      case 3:
        return vscode.DiagnosticSeverity.Hint; // Spectral severity 3 = Hint
      default:
        return vscode.DiagnosticSeverity.Information;
    }
  }
}
