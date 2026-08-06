/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { buildAllServicesLayer as buildBaseServicesLayer } from '@salesforce/effect-ext-utils/out/src/allServicesLayer';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';

export const buildAllServicesLayer = (context: Parameters<typeof buildBaseServicesLayer>[0]) =>
  buildBaseServicesLayer(context, 'Aura Components');

// eslint-disable-next-line functional/no-let -- Module-level mutable; set during activation, read by getRuntime
let allServicesLayer: ReturnType<typeof buildAllServicesLayer>;

export const setAllServicesLayer = (layer: ReturnType<typeof buildAllServicesLayer>): void => {
  allServicesLayer = layer;
};

// eslint-disable-next-line functional/no-let -- Lazy singleton runtime
let _auraRuntime:
  | ManagedRuntime.ManagedRuntime<
      Layer.Layer.Success<ReturnType<typeof buildAllServicesLayer>>,
      Layer.Layer.Error<ReturnType<typeof buildAllServicesLayer>>
    >
  | undefined;

export const getRuntime = () => (_auraRuntime ??= ManagedRuntime.make(allServicesLayer));
