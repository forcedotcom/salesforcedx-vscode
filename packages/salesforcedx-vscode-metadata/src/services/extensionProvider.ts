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
        buildSharedServicesLayer(context, 'Salesforce Metadata'),
        api.services.NotificationModeService.Default(
          'salesforcedx-vscode-metadata',
          'sf-metadata-notifications',
          'Salesforce: Metadata Notifications'
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
 * Single persistent runtime for metadata extension Effect executions.
 * Built once on first use to avoid rebuilding services across command invocations.
 */
type MetadataRuntime = ManagedRuntime.ManagedRuntime<
  Layer.Layer.Success<ReturnType<typeof buildAllServicesLayer>>,
  Layer.Layer.Error<ReturnType<typeof buildAllServicesLayer>>
>;
// eslint-disable-next-line functional/no-let
let _metadataRuntime: MetadataRuntime | undefined;
export const getMetadataRuntime = () => (_metadataRuntime ??= ManagedRuntime.make(AllServicesLayer));

export const disposeMetadataRuntime = async (): Promise<void> => {
  if (_metadataRuntime) {
    await _metadataRuntime.dispose();
    _metadataRuntime = undefined;
  }
};
