/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { LegacyServiceBody, LegacyServiceInstance, LegacyServices } from './legacyTypes.js';
import type * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import type * as Unify from 'effect/Unify';
import { getExistingLegacyService } from './existingLegacyServices.js';

const existing = getExistingLegacyService('ConnectionService');
const body: Effect.Effect<LegacyServiceBody<'ConnectionService'>> = existing;
const ConnectionServiceBase: Effect.Service.Class<
  ConnectionService,
  'ConnectionService',
  { readonly accessors: true; readonly effect: Effect.Effect<LegacyServiceBody<'ConnectionService'>> }
> = Effect.Service<ConnectionService>()('ConnectionService', { accessors: true, effect: body });

export class ConnectionService extends ConnectionServiceBase {
  // Inherited static unification must describe this constructor, including both default forms.
  declare public static readonly [Unify.unifySymbol]?: Context.TagUnify<typeof ConnectionService>;
  public static override readonly Default: Layer.Layer<ConnectionService> = Layer.effect(ConnectionService, existing);
  public static readonly DefaultWithoutDependencies = ConnectionService.Default;
}

export const bindLegacyConnectionService = (
  implementation: LegacyServiceBody<'ConnectionService'>
): {
  readonly Service: LegacyServices['ConnectionService'];
  readonly instance: LegacyServiceInstance<'ConnectionService'>;
} => {
  const instance = ConnectionService.make(implementation);
  class BoundConnectionService extends ConnectionService {
    public static override readonly Default = Layer.succeed(ConnectionService, instance);
    public static override readonly DefaultWithoutDependencies = BoundConnectionService.Default;
  }
  const Service: LegacyServices['ConnectionService'] = BoundConnectionService;
  return { Service, instance };
};
