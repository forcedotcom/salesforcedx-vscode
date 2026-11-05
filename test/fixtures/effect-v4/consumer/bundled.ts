/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { makeFixtureApi } from '../provider/index.js';

const api = makeFixtureApi({ marker: 'bundled-v3' });
export const connection = await Effect.runPromise(
  api.services.ConnectionService.getConnection().pipe(
    Effect.provide(Layer.succeedContext(api.services.prebuiltServicesDependencies))
  )
);
