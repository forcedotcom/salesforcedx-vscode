/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type * as Context from 'effect/Context';
import type * as Duration from 'effect/Duration';
import { makeFakeEffectDriver, type EffectDriver } from './fakeEffectDriver.js';

/**
 * Test-only driver shape for the extension-owned query-results UI. Story 12 supplies its concrete state, actions,
 * failures, and production service tag; the browser harness can use this factory without importing VS Code APIs.
 */
export type QueryResultsDriver<State, Action, Failure> = EffectDriver<State, Action, Failure>;

export const makeFakeQueryResultsDriver = <Identifier, State, Action, Failure>(
  tag: Context.Tag<Identifier, QueryResultsDriver<State, Action, Failure>>,
  initialState: State,
  options: { readonly dispatchLatency?: Duration.DurationInput } = {}
) => makeFakeEffectDriver(tag, initialState, options);
