/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TelemetryService, isInternalHost } from '@salesforce/salesforcedx-utils-vscode';
import { ExtensionContext } from 'vscode';
import { TELEMETRY_GLOBAL_VALUE, TELEMETRY_INTERNAL_VALUE } from '../constants';
import { internalTelemetryMessage, telemetryWithOptOutMessage } from './telemetryMessages';

export const telemetryService = TelemetryService.getInstance();

export const showTelemetryMessage = async (extensionContext: ExtensionContext) => {
  const messageAlreadyPrompted = extensionContext.globalState.get(TELEMETRY_GLOBAL_VALUE);
  const isInternal = isInternalHost();
  const internalMessagePrompted = extensionContext.globalState.get(TELEMETRY_INTERNAL_VALUE);

  if (isInternal && !internalMessagePrompted) {
    await internalTelemetryMessage();
    await extensionContext.globalState.update(TELEMETRY_INTERNAL_VALUE, true);
  }
  if (!messageAlreadyPrompted) {
    await telemetryWithOptOutMessage();
    await extensionContext.globalState.update(TELEMETRY_GLOBAL_VALUE, true);
  }
};
