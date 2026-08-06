/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { buildAllServicesLayer as buildBaseServicesLayer } from '@salesforce/effect-ext-utils/out/src/allServicesLayer';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';

/**
 * Factory for a Layer that provides all services from the SalesforceVSCodeServicesApi.
 * Pass the ExtensionContext to include a working ExtensionContextServiceLayer.
 * When context is not provided, ExtensionContextService.Default is used (fails if getContext is called).
 */
export const buildAllServicesLayer = (context: Parameters<typeof buildBaseServicesLayer>[0]) =>
  buildBaseServicesLayer(context, 'Salesforce Metadata');

/**
 * Layer that provides all services from the SalesforceVSCodeServicesApi.
 * Uses ExtensionContextService.Default (fails if getContext is called).
 * Use AllServicesLayerFor(context) to provide a working ExtensionContextService.
 */
// eslint-disable-next-line functional/no-let
export let AllServicesLayer: ReturnType<typeof buildAllServicesLayer>;

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
