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

const existing = getExistingLegacyService('ConfigService');
const body: Effect.Effect<LegacyServiceBody<'ConfigService'>> = existing;
const ConfigServiceBase: Effect.Service.Class<
  ConfigService,
  'ConfigService',
  { readonly accessors: true; readonly effect: Effect.Effect<LegacyServiceBody<'ConfigService'>> }
> = Effect.Service<ConfigService>()('ConfigService', { accessors: true, effect: body });

export class ConfigService extends ConfigServiceBase {
  // Inherited static unification must describe this constructor, including both default forms.
  declare public static readonly [Unify.unifySymbol]?: Context.TagUnify<typeof ConfigService>;
  public static override readonly Default: Layer.Layer<ConfigService> = Layer.effect(ConfigService, existing);
  public static readonly DefaultWithoutDependencies = ConfigService.Default;
}

export const bindLegacyConfigService = (
  implementation: LegacyServiceBody<'ConfigService'>
): {
  readonly Service: LegacyServices['ConfigService'];
  readonly instance: LegacyServiceInstance<'ConfigService'>;
} => {
  const instance = ConfigService.make(implementation);
  class BoundConfigService extends ConfigService {
    public static override readonly Default = Layer.succeed(ConfigService, instance);
    public static override readonly DefaultWithoutDependencies = BoundConfigService.Default;
  }
  const Service: LegacyServices['ConfigService'] = BoundConfigService;
  return { Service, instance };
};
