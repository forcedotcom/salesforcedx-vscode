/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';

class MissingConfig extends Context.Service<MissingConfig, { readonly value: string }>()('MissingConfig') {}
class NeedsConfig extends Context.Service<NeedsConfig, { readonly value: string }>()('NeedsConfig') {}

const incomplete = Layer.effect(NeedsConfig, MissingConfig);
export const invalidRuntime = ManagedRuntime.make(incomplete);
export const invalidRunner = Effect.runPromise(NeedsConfig);
