/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { commands, Uri, window } from 'vscode';
import { TELEMETRY_OPT_OUT_LINK } from '../../../src/constants';
import { nls } from '../../../src/messages';
import { internalTelemetryMessage, telemetryWithOptOutMessage } from '../../../src/telemetry/telemetryMessages';

describe('Telemetry Messages', () => {
  let spyShowInfoMessage: jest.SpyInstance;

  beforeEach(() => {
    spyShowInfoMessage = jest.spyOn(window, 'showInformationMessage').mockResolvedValue(undefined);
  });

  afterEach(() => {
    spyShowInfoMessage.mockRestore();
  });

  describe('internalTelemetryMessage', () => {
    it('should display the internal telemetry message', async () => {
      const internalMessage = nls.localize('telemetry_internal_user_message');

      await internalTelemetryMessage();
      expect(spyShowInfoMessage).toHaveBeenCalled();
      expect(spyShowInfoMessage).toHaveBeenCalledWith(internalMessage);
    });
  });

  describe('telemetryWithOptOutMessage', () => {
    let spyCommand: jest.SpyInstance;
    const showButtonText = nls.localize('telemetry_legal_dialog_button_text');

    beforeEach(() => {
      spyCommand = jest.spyOn(commands, 'executeCommand');
    });

    afterEach(() => {
      spyCommand.mockRestore();
    });

    it('should display the telemetry message with opt-out link', async () => {
      const showMessage = nls.localize('telemetry_legal_dialog_message', TELEMETRY_OPT_OUT_LINK);

      await telemetryWithOptOutMessage();
      expect(spyShowInfoMessage).toHaveBeenCalledWith(showMessage, showButtonText);
    });

    it('should open the disable telemetry link when the opt-out button is clicked', async () => {
      // Simulate clicking opt-out button
      spyShowInfoMessage.mockResolvedValue(showButtonText);
      await telemetryWithOptOutMessage();
      expect(spyCommand).toHaveBeenCalledWith('vscode.open', Uri.parse(TELEMETRY_OPT_OUT_LINK));
    });

    it('should not open the disable telemetry link if opt-out link is not clicked', async () => {
      await telemetryWithOptOutMessage();
      expect(spyCommand).not.toHaveBeenCalled();
    });
  });
});
