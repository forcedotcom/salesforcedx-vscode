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

const existing = getExistingLegacyService('AliasService');
const body: Effect.Effect<LegacyServiceBody<'AliasService'>> = existing;
const AliasServiceBase: Effect.Service.Class<
  AliasService,
  'AliasService',
  { readonly accessors: true; readonly effect: Effect.Effect<LegacyServiceBody<'AliasService'>> }
> = Effect.Service<AliasService>()('AliasService', { accessors: true, effect: body });

export class AliasService extends AliasServiceBase {
  // Inherited static unification must describe this constructor, including both default forms.
  declare public static readonly [Unify.unifySymbol]?: Context.TagUnify<typeof AliasService>;
  public static override readonly Default: Layer.Layer<AliasService> = Layer.effect(AliasService, existing);
  public static readonly DefaultWithoutDependencies = AliasService.Default;
}

export const bindLegacyAliasService = (
  implementation: LegacyServiceBody<'AliasService'>
): {
  readonly Service: LegacyServices['AliasService'];
  readonly instance: LegacyServiceInstance<'AliasService'>;
} => {
  const instance = AliasService.make(implementation);
  class BoundAliasService extends AliasService {
    public static override readonly Default = Layer.succeed(AliasService, instance);
    public static override readonly DefaultWithoutDependencies = BoundAliasService.Default;
  }
  const Service: LegacyServices['AliasService'] = BoundAliasService;
  return { Service, instance };
};
