/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TelemetryService } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { BASE_EXTENSION, EXPANDED_EXTENSION, EXT_PACK_STATUS_EVENT_NAME } from '../constants';

export enum EXT_PACK_TYPES {
  BASE = 'BASE',
  EXPANDED = 'EXPANDED',
  BOTH = 'BOTH',
  NONE = 'NONE'
}

export class MetricsReporter {
  public static extensionPackStatus = (): void => {
    const extensionPackStatus = MetricsReporter.getExtensionPackStatus();
    TelemetryService.getInstance().sendEventData(EXT_PACK_STATUS_EVENT_NAME, { extpack: extensionPackStatus });
  };

  private static getExtensionPackStatus = (): EXT_PACK_TYPES => {
    const hasBasePack = this.isExtensionInstalled(BASE_EXTENSION);
    const hasExpandedPack = this.isExtensionInstalled(EXPANDED_EXTENSION);

    let status = EXT_PACK_TYPES.NONE;

    if (hasBasePack && hasExpandedPack) {
      status = EXT_PACK_TYPES.BOTH;
    } else if (hasBasePack) {
      status = EXT_PACK_TYPES.BASE;
    } else if (hasExpandedPack) {
      status = EXT_PACK_TYPES.EXPANDED;
    }
    return status;
  };

  private static isExtensionInstalled = (extensionName: string): boolean => {
    const extension = vscode.extensions.getExtension(extensionName);
    return extension !== undefined;
  };
}
