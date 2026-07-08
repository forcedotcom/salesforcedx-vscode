/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type buildAllServicesLayer } from '@salesforce/effect-ext-utils';
import type * as Layer from 'effect/Layer';

type OpaqueServicesLayer = Layer.Layer<any, never>;

export let AllServicesLayer: OpaqueServicesLayer;

export const setAllServicesLayer = (layer: ReturnType<typeof buildAllServicesLayer>) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- deliberate narrowing: any→never for errors prevents type poisoning through Effect.provide
  AllServicesLayer = layer as OpaqueServicesLayer;
};
