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
import { OrgBrowserRetrieveService } from './orgBrowserMetadataRetrieveService';

/**
 * Factory for a Layer that provides all shared services plus the org-browser-specific
 * OrgBrowserRetrieveService (which needs only ExtensionProviderService, present in the shared build).
 */
export const buildAllServicesLayer = (context: ExtensionContext) =>
  Layer.unwrapEffect(
    Effect.map(getServicesApi, api =>
      Layer.mergeAll(
        buildSharedServicesLayer(context, 'Salesforce Org Browser'),
        OrgBrowserRetrieveService.Default,
        api.services.NotificationModeService.Default(
          'salesforcedx-vscode-org-browser',
          'sf-org-browser-notifications',
          'Salesforce: Org Browser Notifications'
        )
      )
    )
  );

// eslint-disable-next-line functional/no-let
let AllServicesLayer: ReturnType<typeof buildAllServicesLayer>;

export const setAllServicesLayer = (layer: ReturnType<typeof buildAllServicesLayer>) => {
  AllServicesLayer = layer;
};

/**
 * Single persistent runtime for org-browser Effect executions.
 * Built once on first use to avoid rebuilding ComponentSetService and other
 * stateful services on each tree-node expansion
 */
type OrgBrowserRuntime = ManagedRuntime.ManagedRuntime<
  Layer.Layer.Success<ReturnType<typeof buildAllServicesLayer>>,
  Layer.Layer.Error<ReturnType<typeof buildAllServicesLayer>>
>;
// eslint-disable-next-line functional/no-let
let _orgBrowserRuntime: OrgBrowserRuntime | undefined;
export const getOrgBrowserRuntime = () => (_orgBrowserRuntime ??= ManagedRuntime.make(AllServicesLayer));

export const disposeOrgBrowserRuntime = async (): Promise<void> => {
  if (_orgBrowserRuntime) {
    await _orgBrowserRuntime.dispose();
    _orgBrowserRuntime = undefined;
  }
};
