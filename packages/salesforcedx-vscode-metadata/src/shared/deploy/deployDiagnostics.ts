/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { FileResponseFailure } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { Utils, type URI } from 'vscode-uri';

const deployErrorCollection = vscode.languages.createDiagnosticCollection('deploy-errors');

const fixupError = (error: string | undefined): string =>
  error !== undefined ? error.replace(/\(\d+:\d+\)/, '').trim() : 'Unknown error occurred.';

const getRange = (lineNumber = 1, columnNumber = 1): vscode.Range => {
  const pos = new vscode.Position(lineNumber > 0 ? lineNumber - 1 : 0, columnNumber > 0 ? columnNumber - 1 : 0);
  return new vscode.Range(pos, pos);
};

const handleDuplicateDiagnostics = (diagnosticMap: Map<URI, vscode.Diagnostic[]>): Map<URI, vscode.Diagnostic[]> =>
  new Map(
    [...diagnosticMap.entries()].map(([uri, diagnostics]) => {
      const existingKeys = new Set(vscode.languages.getDiagnostics(uri).map(d => d.message));
      const filtered = diagnostics.filter(d => {
        if (existingKeys.has(d.message)) return false;
        existingKeys.add(d.message);
        return true;
      });
      return [uri, filtered] as const;
    })
  );

/** Clear deploy diagnostics. Call at start of deployComponentSet to avoid duplicates from previous runs. */
export const clearDeployDiagnostics = (): void => {
  deployErrorCollection.clear();
};

const resolveFileUri = Effect.fn('deployDiagnostics.resolveFileUri')(function* (
  workspaceUri: URI,
  filePath: string | undefined
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fs = yield* api.services.FsService;
  const workspacePath = yield* fs.uriToPath(workspaceUri);
  const isAbsolute = filePath && (filePath.startsWith('/') || filePath.includes(workspacePath));
  return isAbsolute ? yield* fs.toUri(filePath) : Utils.resolvePath(workspaceUri, filePath ?? '');
});

/** Apply deploy failures to Problems panel. Clears first, then sets failures. Caller filters with ComponentSetService.isSDRFailure. */
export const applyDeployDiagnostics = Effect.fn('applyDeployDiagnostics')(function* (
  failedResponses: FileResponseFailure[]
) {
  const workspaceUri = yield* (yield* ExtensionProviderService).getServicesApi.pipe(
    Effect.flatMap(api => api.services.WorkspaceService.getWorkspaceInfoOrThrow()),
    Effect.map(w => w.uri)
  );

  deployErrorCollection.clear();

  const entries = yield* Effect.all(
    failedResponses.map(fileResponse =>
      Effect.gen(function* () {
        const fileUri = yield* resolveFileUri(workspaceUri, fileResponse.filePath);
        const { lineNumber, columnNumber, error, problemType, type } = fileResponse;
        const range = getRange(lineNumber, columnNumber);
        const severity = problemType === 'Error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
        const vscDiagnostic: vscode.Diagnostic = {
          message: fixupError(error),
          range,
          severity,
          source: type
        };
        return [fileUri, vscDiagnostic] as const;
      })
    ),
    { concurrency: 'unbounded' }
  );

  const byUri = Object.groupBy(entries, ([uri]) => uri.toString());
  const toEntry = (uri: URI, diags: vscode.Diagnostic[]): [URI, vscode.Diagnostic[]] => [uri, diags];
  const diagnosticMap = new Map<URI, vscode.Diagnostic[]>(
    Object.values(byUri).map(pairs => {
      const [uri] = pairs![0];
      return toEntry(
        uri,
        pairs!.map(([, d]) => d)
      );
    })
  );

  [...handleDuplicateDiagnostics(diagnosticMap).entries()].map(([uri, diagMap]) =>
    deployErrorCollection.set(uri, diagMap.length > 0 ? diagMap : undefined)
  );
});
