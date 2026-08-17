/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { buildAllServicesLayer as buildSharedServicesLayer, getServicesApi } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import type { ExtensionContext } from 'vscode';

/**
 * Layer providing all services from SalesforceVSCodeServicesApi plus NotificationModeService
 * for notification configuration.
 */
export const buildAllServicesLayer = (context: ExtensionContext) =>
  Layer.unwrapEffect(
    Effect.map(getServicesApi, api =>
      Layer.mergeAll(
        buildSharedServicesLayer(context, 'Salesforce Org Management'),
        api.services.NotificationModeService.Default(
          'salesforcedx-vscode-org',
          'sf-org-notifications',
          'Salesforce: Org Notifications'
        )
      )
    )
  );

let AllServicesLayer: ReturnType<typeof buildAllServicesLayer>;

export const setAllServicesLayer = (layer: ReturnType<typeof buildAllServicesLayer>) => {
  AllServicesLayer = layer;
};

/**
 * Single persistent runtime for org extension Effect executions.
 * Built once on first use to avoid rebuilding services across commands.
 */
/** Services provided by the org runtime (the `R` channel an Effect may require when run via {@link getOrgRuntime}). */
type OrgRuntimeContext = Layer.Layer.Success<ReturnType<typeof buildAllServicesLayer>>;

type OrgRuntime = ManagedRuntime.ManagedRuntime<
  OrgRuntimeContext,
  Layer.Layer.Error<ReturnType<typeof buildAllServicesLayer>>
>;
let _orgRuntime: OrgRuntime | undefined;
export const getOrgRuntime = () => (_orgRuntime ??= ManagedRuntime.make(AllServicesLayer));

export const disposeOrgRuntime = async (): Promise<void> => {
  if (_orgRuntime) {
    await _orgRuntime.dispose();
    _orgRuntime = undefined;
  }
};

/** Reset cached runtime. Used by tests when AllServicesLayer changes between tests. */
export const resetOrgRuntimeForTesting = (): void => {
  _orgRuntime = undefined;
};
