/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SoqlBuilderAction, SoqlBuilderServiceError, SoqlBuilderState } from '../domain.js';
import type * as Duration from 'effect/Duration';
import { SoqlBuilderService } from '../effect/soqlBuilderService.js';
import { makeFakeEffectDriver, type FakeEffectDriver, type FakeEffectDriverStats } from './fakeEffectDriver.js';

export type FakeSoqlBuilderServiceStats = FakeEffectDriverStats;
export type FakeSoqlBuilderService = FakeEffectDriver<
  SoqlBuilderService,
  SoqlBuilderState,
  SoqlBuilderAction,
  SoqlBuilderServiceError
>;

export const makeFakeSoqlBuilderService = (
  initialState: SoqlBuilderState,
  options: { readonly dispatchLatency?: Duration.DurationInput } = {}
) => makeFakeEffectDriver(SoqlBuilderService, initialState, options);
