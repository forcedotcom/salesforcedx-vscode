/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Option from 'effect/Option';

export const makeVscodeExtensionRuntime = <R, E>(
  layer: Layer.Layer<R, E, never>
): ManagedRuntime.ManagedRuntime<R, E> =>
  ManagedRuntime.make(layer.pipe(Layer.merge(Layer.setVersionMismatchErrorLogLevel(Option.none()))));
