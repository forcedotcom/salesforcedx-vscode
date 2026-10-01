/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SoqlBuilderAction, SoqlBuilderServiceError, SoqlBuilderState } from '../domain.js';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import type * as Stream from 'effect/Stream';

/** Browser-safe Effect service implemented by the environment that embeds the SOQL Builder UI. */
export type SoqlBuilderService = {
  readonly initialState: Effect.Effect<SoqlBuilderState, SoqlBuilderServiceError>;
  readonly stateChanges: Stream.Stream<SoqlBuilderState, SoqlBuilderServiceError>;
  readonly dispatch: (action: SoqlBuilderAction) => Effect.Effect<void, SoqlBuilderServiceError>;
};

export const SoqlBuilderService = Context.GenericTag<SoqlBuilderService>(
  '@salesforce/soql-builder-ui/SoqlBuilderService'
);
