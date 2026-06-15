/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { buildAllServicesLayer as buildBaseServicesLayer } from '@salesforce/effect-ext-utils';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import type { ExtensionContext } from 'vscode';
import { ApexMetadataService } from './apexMetadataService';
import { LLMService } from './llmService';

export const buildAllServicesLayer = (context: ExtensionContext, fallbackDisplayName: string) =>
  Layer.merge(
    buildBaseServicesLayer(context, fallbackDisplayName),
    Layer.mergeAll(ApexMetadataService.Default, LLMService.Default)
  );

// eslint-disable-next-line functional/no-let -- Module-level mutable for setAllServicesLayer (tests/debug)
let AllServicesLayer: ReturnType<typeof buildAllServicesLayer>;

export const setAllServicesLayer = (layer: ReturnType<typeof buildAllServicesLayer>) => {
  AllServicesLayer = layer;
};

type ApexOasRuntime = ManagedRuntime.ManagedRuntime<
  Layer.Layer.Success<ReturnType<typeof buildAllServicesLayer>>,
  Layer.Layer.Error<ReturnType<typeof buildAllServicesLayer>>
>;
// eslint-disable-next-line functional/no-let -- Lazy singleton runtime
let _apexOasRuntime: ApexOasRuntime | undefined;
export const getApexOasRuntime = () => (_apexOasRuntime ??= ManagedRuntime.make(AllServicesLayer));
