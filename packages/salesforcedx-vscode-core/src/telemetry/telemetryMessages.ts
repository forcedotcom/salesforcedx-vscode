/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { commands, Uri, window } from 'vscode';
import { TELEMETRY_OPT_OUT_LINK } from '../constants';
import { nls } from '../messages';

// eslint-disable-next-line @typescript-eslint/require-await
export const internalTelemetryMessage = async () => {
  const internalMessage = nls.localize('telemetry_internal_user_message');
  void window.showInformationMessage(internalMessage);
};

export const telemetryWithOptOutMessage = async () => {
  const showButtonText = nls.localize('telemetry_legal_dialog_button_text');
  const showMessage = nls.localize('telemetry_legal_dialog_message', TELEMETRY_OPT_OUT_LINK);
  await window.showInformationMessage(showMessage, showButtonText).then(selection => {
    // Open disable telemetry link
    if (selection && selection === showButtonText) {
      void commands.executeCommand('vscode.open', Uri.parse(TELEMETRY_OPT_OUT_LINK));
    }
  });
};
