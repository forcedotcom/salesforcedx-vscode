/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';

const BASE_EXTENSION = 'salesforce.salesforcedx-vscode';
const EXPANDED_EXTENSION = 'salesforce.salesforcedx-vscode-expanded';

const getExtensionPackType = (): 'BASE' | 'EXPANDED' | 'BOTH' | 'NONE' => {
  const hasBase = vscode.extensions.getExtension(BASE_EXTENSION) !== undefined;
  const hasExpanded = vscode.extensions.getExtension(EXPANDED_EXTENSION) !== undefined;
  return hasBase && hasExpanded ? 'BOTH' : hasBase ? 'BASE' : hasExpanded ? 'EXPANDED' : 'NONE';
};

/** Annotates the current span with the installed extension pack type (BASE/EXPANDED/BOTH/NONE) */
export const annotateExtensionPackType = Effect.sync(getExtensionPackType).pipe(
  Effect.flatMap(extpack => Effect.annotateCurrentSpan({ extpack }))
);
