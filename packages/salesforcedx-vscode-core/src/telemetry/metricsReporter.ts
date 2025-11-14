/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TelemetryService } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { BASE_EXTENSION, EXPANDED_EXTENSION, EXT_PACK_STATUS_EVENT_NAME } from '../constants';

type EXT_PACK_TYPES = 'BASE' | 'EXPANDED' | 'BOTH' | 'NONE';

const isExtensionInstalled = (extensionName: string): boolean =>
  vscode.extensions.getExtension(extensionName) !== undefined;

const getExtensionPackStatus = (): EXT_PACK_TYPES => {
  const hasBasePack = isExtensionInstalled(BASE_EXTENSION);
  const hasExpandedPack = isExtensionInstalled(EXPANDED_EXTENSION);

  if (hasBasePack && hasExpandedPack) {
    return 'BOTH';
  }
  if (hasBasePack) {
    return 'BASE';
  }
  if (hasExpandedPack) {
    return 'EXPANDED';
  }
  return 'NONE';
};

/** Reports extension pack status telemetry */
export const reportExtensionPackStatus = (): void => {
  const extensionPackStatus = getExtensionPackStatus();
  TelemetryService.getInstance().sendEventData(EXT_PACK_STATUS_EVENT_NAME, { extpack: extensionPackStatus });
};
