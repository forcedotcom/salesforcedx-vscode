/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import type { URI } from 'vscode-uri';

export type OpenSourceDocument = {
  readonly uri: { readonly toString: () => string };
  readonly getText: () => string;
};

/** Resolves source without revealing files, preferring an existing editor buffer over disk. */
export const resolveSourceText = <E, R>(
  uri: URI,
  openDocuments: readonly OpenSourceDocument[],
  readFile: (path: string) => Effect.Effect<string, E, R>
) => {
  const document = openDocuments.find(candidate => candidate.uri.toString() === uri.toString());
  return document ? Effect.succeed(document.getText()) : readFile(uri.fsPath);
};
