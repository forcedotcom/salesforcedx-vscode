/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SoqlBuilderState } from '../domain.js';
import type * as Duration from 'effect/Duration';
import type * as Effect from 'effect/Effect';
import { SoqlBuilderService } from '../effect/soqlBuilderService.js';
import { makeFakeEffectService, type FakeEffectServiceStats } from './fakeEffectService.js';

export type FakeSoqlBuilderServiceStats = FakeEffectServiceStats;

export const makeFakeSoqlBuilderService = (
  initialState: SoqlBuilderState,
  options: { readonly dispatchLatency?: Duration.DurationInput } = {}
) => makeFakeEffectService(SoqlBuilderService, initialState, options);

export type FakeSoqlBuilderService = Effect.Effect.Success<ReturnType<typeof makeFakeSoqlBuilderService>>;
