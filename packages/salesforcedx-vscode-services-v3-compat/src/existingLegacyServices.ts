/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type {
  LegacyPrebuiltServices,
  LegacyServices,
  LegacyServiceInstance,
  LegacySharedServiceName,
  FullLegacyServicesApi
} from './legacyTypes.js';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';

const getActivatedLegacyServices = Effect.fn('V3Compatibility.getActivatedServices')(
  function* (): Effect.fn.Return<LegacyServices> {
    // Lazy: bound API classes never discover VS Code or reenter their provider's activation.
    const vscode = yield* Effect.promise(() => import('vscode'));
    const extension = vscode.extensions.getExtension<FullLegacyServicesApi>('salesforce.salesforcedx-vscode-services');
    if (!extension)
      return yield* Effect.die(new Error('Salesforce Services extension is required to acquire shared services'));
    return extension.isActive
      ? extension.exports.services
      : (yield* Effect.promise(() => extension.activate())).services;
  }
);

/** Source facades prefer the caller's already-provided V3 instance; fallback acquires the actual provider, never a graph. */
export const getExistingLegacyService: <Name extends LegacySharedServiceName>(
  name: Name
) => Effect.Effect<LegacyServiceInstance<Name>> = Effect.fn('V3Compatibility.getExistingService')(<
  Name extends LegacySharedServiceName
>(
  name: Name
): Effect.Effect<LegacyServiceInstance<Name>> => {
  const tag = Context.GenericTag<LegacyPrebuiltServices, LegacyServiceInstance<Name>>(name);
  return Effect.serviceOption(tag).pipe(
    Effect.flatMap(
      Option.match({
        onSome: Effect.succeed,
        onNone: () =>
          getActivatedLegacyServices().pipe(Effect.map(api => Context.get(api.prebuiltServicesDependencies, tag)))
      })
    )
  );
});
