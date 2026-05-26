/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ProcessorInputOutput } from './processorStep';
import { Spectral } from '@stoplight/spectral-core';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { stringify } from 'yaml';
import ruleset from './ruleset.spectral';

const mapSeverity = (severity: number): vscode.DiagnosticSeverity => {
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
};

export const oasValidationStep = Effect.fn('ApexOas.Process.oasValidation')(function* (input: ProcessorInputOutput) {
  const spectral = new Spectral();
  spectral.setRuleset(ruleset);
  const results = yield* Effect.promise(() => spectral.run(stringify(input.openAPIDoc)));
  const diagnostics = results.map(
    result =>
      new vscode.Diagnostic(
        new vscode.Range(
          result.range.start.line,
          result.range.start.character,
          result.range.end.line,
          result.range.end.character
        ),
        result.message,
        mapSeverity(result.severity)
      )
  );
  return { ...input, errors: [...input.errors, ...diagnostics] };
});
