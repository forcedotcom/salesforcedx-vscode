/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';

export class OasDiagnosticsService extends Effect.Service<OasDiagnosticsService>()('OasDiagnosticsService', {
  accessors: true,
  scoped: Effect.gen(function* () {
    const diagnostics = vscode.languages.createDiagnosticCollection('OAS Validations');
    yield* Effect.addFinalizer(() => Effect.sync(() => diagnostics.dispose()));

    const replace = Effect.fn('OasDiagnosticsService.replace')(function* (
      uri: URI,
      entries: readonly vscode.Diagnostic[]
    ) {
      yield* Effect.sync(() => {
        diagnostics.clear();
        diagnostics.set(uri, [...entries]);
      });
    });

    return { replace };
  })
}) {}
