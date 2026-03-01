/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Layer from 'effect/Layer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any for services avoids circular type dep; never for errors prevents type poisoning through Effect.provide
type OpaqueServicesLayer = Layer.Layer<any, never>;

// eslint-disable-next-line functional/no-let -- Module-level mutable for setAllServicesLayer (tests/debug)
export let AllServicesLayer: OpaqueServicesLayer;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- accepts any layer error type, narrows to never to contain the cast
export const setAllServicesLayer = (layer: Layer.Layer<any, any>) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- deliberate narrowing: any→never for errors prevents type poisoning through Effect.provide
  AllServicesLayer = layer as OpaqueServicesLayer;
};
