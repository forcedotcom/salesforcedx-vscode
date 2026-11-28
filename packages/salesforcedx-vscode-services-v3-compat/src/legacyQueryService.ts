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

const existing = getExistingLegacyService('QueryService');
const body: Effect.Effect<LegacyServiceBody<'QueryService'>> = existing;
const QueryServiceBase: Effect.Service.Class<
  QueryService,
  'QueryService',
  { readonly accessors: true; readonly effect: Effect.Effect<LegacyServiceBody<'QueryService'>> }
> = Effect.Service<QueryService>()('QueryService', { accessors: true, effect: body });

export class QueryService extends QueryServiceBase {
  // Inherited static unification must describe this constructor, including both default forms.
  declare public static readonly [Unify.unifySymbol]?: Context.TagUnify<typeof QueryService>;
  public static override readonly Default: Layer.Layer<QueryService> = Layer.effect(QueryService, existing);
  public static readonly DefaultWithoutDependencies = QueryService.Default;
}

export const bindLegacyQueryService = (
  implementation: LegacyServiceBody<'QueryService'>
): {
  readonly Service: LegacyServices['QueryService'];
  readonly instance: LegacyServiceInstance<'QueryService'>;
} => {
  const instance = QueryService.make(implementation);
  class BoundQueryService extends QueryService {
    public static override readonly Default = Layer.succeed(QueryService, instance);
    public static override readonly DefaultWithoutDependencies = BoundQueryService.Default;
  }
  const Service: LegacyServices['QueryService'] = BoundQueryService;
  return { Service, instance };
};
