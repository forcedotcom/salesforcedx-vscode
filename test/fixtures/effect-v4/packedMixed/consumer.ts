/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SalesforceVSCodeServicesApi } from '@salesforce/vscode-services';
import type { SalesforceVSCodeServicesApiV2 } from '@salesforce/vscode-services-v2';
import * as V3Effect from 'effect-v3/Effect';
import * as V3Layer from 'effect-v3/Layer';
import * as V3SubscriptionRef from 'effect-v3/SubscriptionRef';
import * as V4Effect from 'effect/Effect';
import * as V4Layer from 'effect/Layer';
import * as V4SubscriptionRef from 'effect/SubscriptionRef';

export const crossMajorControls = (legacy: SalesforceVSCodeServicesApi, current: SalesforceVSCodeServicesApiV2) => {
  const v3 = legacy.services.ConnectionService.getConnection().pipe(
    V3Effect.provide(V3Layer.succeedContext(legacy.services.prebuiltServicesDependencies))
  );
  const v4 = current.v2.services.ConnectionService.use(service => service.getConnection()).pipe(
    V4Effect.provide(V4Layer.succeedContext(current.v2.services.prebuiltServicesDependencies))
  );
  // @ts-expect-error Real packed V4 Effect cannot enter a V3 runner.
  V3Effect.runPromise(v4);
  // @ts-expect-error Real packed V3 Effect cannot enter a V4 runner.
  V4Effect.runPromise(v3);
  // @ts-expect-error Real packed V4 Context is not a V3 Context.
  V3Layer.succeedContext(current.v2.services.prebuiltServicesDependencies);
  // @ts-expect-error Real packed V3 Context is not a V4 Context.
  V4Layer.succeedContext(legacy.services.prebuiltServicesDependencies);
  // @ts-expect-error Real packed V4 Layer cannot provide a V3 program.
  v3.pipe(V3Effect.provide(current.v2.services.prebuiltServicesLayer));
  // @ts-expect-error Real packed V3 Layer cannot provide a V4 program.
  v4.pipe(V4Effect.provide(legacy.services.prebuiltServicesLayer));
  return { v3, v4 };
};

export const refControls = (
  legacy: V3Effect.Effect.Success<ReturnType<SalesforceVSCodeServicesApi['services']['TargetOrgRef']>>,
  current: V4Effect.Success<SalesforceVSCodeServicesApiV2['v2']['services']['TargetOrgRef']>
) => {
  // @ts-expect-error Real packed V4 ref cannot enter V3 operations.
  V3SubscriptionRef.get(current);
  // @ts-expect-error Real packed V3 ref cannot enter V4 operations.
  V4SubscriptionRef.get(legacy);
  return { legacy, current };
};
