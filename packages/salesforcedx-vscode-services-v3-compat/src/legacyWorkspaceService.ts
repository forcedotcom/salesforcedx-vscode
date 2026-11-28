/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { LegacyServiceBody, LegacyServiceInstance, LegacyServices } from './legacyTypes.js';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { getExistingLegacyService } from './existingLegacyServices.js';

const existing = getExistingLegacyService('WorkspaceService');
// The constructor accepts the frozen body, not the existing instance's additional _tag field.
const body: Effect.Effect<LegacyServiceBody<'WorkspaceService'>> = existing;

const WorkspaceServiceBase: Effect.Service.Class<
  WorkspaceService,
  'WorkspaceService',
  {
    readonly accessors: true;
    readonly effect: Effect.Effect<LegacyServiceBody<'WorkspaceService'>>;
  }
> = Effect.Service<WorkspaceService>()('WorkspaceService', {
  accessors: true,
  effect: body
});

/** V3 source-path facade. Its default reuses a supplied instance or the actual provider; never acquires a backend. */
export class WorkspaceService extends WorkspaceServiceBase {
  public static override readonly Default: Layer.Layer<WorkspaceService> = Layer.effect(WorkspaceService, existing);
}

/** Bind a genuine V3 class and its default to one already-owned adapter instance. */
export const bindLegacyWorkspaceService = (
  implementation: LegacyServiceBody<'WorkspaceService'>
): {
  readonly Service: LegacyServices['WorkspaceService'];
  readonly instance: LegacyServiceInstance<'WorkspaceService'>;
} => {
  const instance = WorkspaceService.make(implementation);
  class BoundWorkspaceService extends WorkspaceService {
    public static override readonly Default = Layer.succeed(WorkspaceService, instance);
  }
  const Service: LegacyServices['WorkspaceService'] = BoundWorkspaceService;
  return { Service, instance };
};
