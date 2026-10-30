/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { FsServiceError } from './errors.js';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import type { URI } from 'vscode-uri';

export type LightningComponentKind = 'lwc' | 'aura';
export type RenameBundleParams = {
  readonly bundleUri: URI;
  readonly oldName: string;
  readonly newName: string;
  readonly kind: LightningComponentKind;
};
export class LightningComponentService extends Context.Service<
  LightningComponentService,
  { readonly renameBundle: (params: RenameBundleParams) => Effect.Effect<URI, FsServiceError> }
>()('@salesforce/vscode-services-v2/LightningComponentService') {}
