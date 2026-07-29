/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  buildAllServicesLayer as buildBaseServicesLayer,
  NotificationModeServiceLayer
} from '@salesforce/effect-ext-utils';
import * as Layer from 'effect/Layer';
import type { ExtensionContext } from 'vscode';

export const buildAllServicesLayer = (context: ExtensionContext, fallbackDisplayName: string) =>
  Layer.merge(
    buildBaseServicesLayer(context, fallbackDisplayName),
    NotificationModeServiceLayer(
      'salesforcedx-vscode-apex-debugger',
      'sf-apex-debugger-notifications',
      'Salesforce: Apex Interactive Debugger Notifications'
    )
  );

export let AllServicesLayer: ReturnType<typeof buildAllServicesLayer>;

export const setAllServicesLayer = (layer: ReturnType<typeof buildAllServicesLayer>) => {
  AllServicesLayer = layer;
};
