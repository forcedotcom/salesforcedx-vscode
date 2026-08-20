/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SoqlBuilderAction, SoqlBuilderDriverError, SoqlBuilderState } from '../domain.js';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import type * as Stream from 'effect/Stream';

export type SoqlBuilderDriver = {
  readonly initialState: Effect.Effect<SoqlBuilderState, SoqlBuilderDriverError>;
  readonly stateChanges: Stream.Stream<SoqlBuilderState, SoqlBuilderDriverError>;
  readonly dispatch: (action: SoqlBuilderAction) => Effect.Effect<void, SoqlBuilderDriverError>;
};

export const SoqlBuilderDriver = Context.GenericTag<SoqlBuilderDriver>('@salesforce/soql-builder-ui/driver');
