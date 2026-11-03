/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SdkLayerConfig, V2SdkLayerFor } from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { getSdkLayerConfigFromContext, getSdkLayerConfigFromPackageJSON, isExtensionContext } from './sdkLayerConfig';
import { NodeSdkLayerFor } from './spansNode';
import { WebSdkLayerFor } from './spansWeb';

/**
 * Factory for per-extension SDK layers.
 * Each extension gets its own tracer with extension.name in resource attributes.
 */
export const SdkLayerFor: V2SdkLayerFor = (input: SdkLayerConfig | vscode.ExtensionContext) => {
  const config = isExtensionContext(input) ? getSdkLayerConfigFromContext(input) : input;
  return process.env.ESBUILD_PLATFORM === 'web' ? WebSdkLayerFor(config) : NodeSdkLayerFor(config);
};

const servicesSdkLayer = Layer.unwrap(
  Effect.sync(() => {
    const extension = vscode.extensions.getExtension('salesforce.salesforcedx-vscode-services');
    return SdkLayerFor(
      getSdkLayerConfigFromPackageJSON({
        name: 'salesforcedx-vscode-services',
        version: 'unknown',
        ...extension?.packageJSON
      })
    );
  })
);

/** Stable layer identity shares one services SDK across bootstrap/domain scopes using the same memo map. */
export const ServicesSdkLayer = () => servicesSdkLayer;
