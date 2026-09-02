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

export const buildAllServicesLayer = (context: ExtensionContext) =>
  Layer.unwrapEffect(
    Effect.map(getServicesApi, api =>
      Layer.mergeAll(
        buildSharedServicesLayer(context, 'SOQL'),
        api.services.NotificationModeService.Default(
          'salesforcedx-vscode-soql',
          'sf-soql-notifications',
          'Salesforce: SOQL Notifications'
        )
      )
    )
  );

let AllServicesLayer: ReturnType<typeof buildAllServicesLayer>;

export const setAllServicesLayer = (layer: ReturnType<typeof buildAllServicesLayer>) => {
  AllServicesLayer = layer;
};

/**
 * Single persistent runtime for all SOQL extension Effect executions.
 * Built once on first use to avoid rebuilding catalog dependencies and other
 * stateful services across sobject_metadata_request, sobjects_request, and code-completion calls.
 */
type SoqlRuntime = ManagedRuntime.ManagedRuntime<
  Layer.Layer.Success<ReturnType<typeof buildAllServicesLayer>>,
  Layer.Layer.Error<ReturnType<typeof buildAllServicesLayer>>
>;
let _soqlRuntime: SoqlRuntime | undefined;
export const getSoqlRuntime = () => (_soqlRuntime ??= ManagedRuntime.make(AllServicesLayer));

export const disposeSoqlRuntime = async (): Promise<void> => {
  if (_soqlRuntime) {
    await _soqlRuntime.dispose();
    _soqlRuntime = undefined;
  }
};
