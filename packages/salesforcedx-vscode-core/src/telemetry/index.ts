/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TelemetryService } from '@salesforce/salesforcedx-utils-vscode';
import { commands, ExtensionContext, Uri, window } from 'vscode';
import { TELEMETRY_GLOBAL_VALUE, TELEMETRY_OPT_OUT_LINK } from '../constants';
import { nls } from '../messages';

export const telemetryService = TelemetryService.getInstance();

export const showTelemetryMessage = async (extensionContext: ExtensionContext) => {
  const messageAlreadyPrompted = extensionContext.globalState.get(
    TELEMETRY_GLOBAL_VALUE
  );
  if (!messageAlreadyPrompted) {
    // Show the message and set telemetry to true;
    const showButtonText = nls.localize('telemetry_legal_dialog_button_text');
    const showMessage = nls.localize(
      'telemetry_legal_dialog_message',
      TELEMETRY_OPT_OUT_LINK
    );
    await window
      .showInformationMessage(showMessage, showButtonText)
      .then(selection => {
        // Open disable telemetry link
        if (selection && selection === showButtonText) {
          void commands.executeCommand(
            'vscode.open',
            Uri.parse(TELEMETRY_OPT_OUT_LINK)
          );
        }
      });
    void extensionContext.globalState.update(TELEMETRY_GLOBAL_VALUE, true);
  }
};
