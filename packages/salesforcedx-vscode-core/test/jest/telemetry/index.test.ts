/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TELEMETRY_GLOBAL_USER_ID } from '@salesforce/salesforcedx-utils-vscode';
import * as os from 'os';
import { extensions, window, Extension } from 'vscode';
import { TELEMETRY_GLOBAL_VALUE, TELEMETRY_INTERNAL_VALUE, TELEMETRY_OPT_OUT_LINK } from '../../../src/constants';
import { nls } from '../../../src/messages';
import { SalesforceCoreSettings } from '../../../src/settings/salesforceCoreSettings';
import { showTelemetryMessage, telemetryService } from '../../../src/telemetry';
import { MockExtensionContext } from './MockExtensionContext';

describe('Telemetry', () => {
  let mShowInformation: jest.SpyInstance;
  let settings: jest.SpyInstance;
  let mockExtensionContext: MockExtensionContext;
  let teleSpy: jest.SpyInstance;
  let cliSpy: jest.SpyInstance;

  beforeEach(() => {
    mShowInformation = jest.spyOn(window, 'showInformationMessage').mockResolvedValue(undefined);
    settings = jest.spyOn(SalesforceCoreSettings.prototype, 'getTelemetryEnabled').mockReturnValue(true);
    teleSpy = jest.spyOn(telemetryService, 'setCliTelemetryEnabled');
    cliSpy = jest.spyOn(telemetryService, 'checkCliTelemetry').mockResolvedValue(true);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('showTelemetryMessage', () => {
    let globalStateTelemetrySpy: jest.SpyInstance;
    const showButtonText = nls.localize('telemetry_legal_dialog_button_text');
    const showMessage = nls.localize('telemetry_legal_dialog_message', TELEMETRY_OPT_OUT_LINK);
    const internalMessage = nls.localize('telemetry_internal_user_message');

    const handleTelemetryMsgShown = (key: string, globalMsgShown: boolean, internalMsgShown: boolean) => {
      if (key === TELEMETRY_GLOBAL_USER_ID) {
        return key;
      }
      if (key === TELEMETRY_GLOBAL_VALUE) {
        return globalMsgShown;
      }
      if (key === TELEMETRY_INTERNAL_VALUE) {
        return internalMsgShown;
      }
      throw new Error('unknown key');
    };

    beforeEach(() => {
      // create vscode extensionContext
      mockExtensionContext = new MockExtensionContext();
      globalStateTelemetrySpy = jest.spyOn(mockExtensionContext.globalState, 'get');
    });

    it('should show telemetry opt-out info message only when user is external', async () => {
      // create telemetry shown states
      globalStateTelemetrySpy.mockImplementation(key => {
        return handleTelemetryMsgShown(key, false, false);
      });
      // mock out the isInternalHost call
      jest.spyOn(os, 'hostname').mockReturnValue('test-host');

      await telemetryService.initializeService(mockExtensionContext);

      const telemetryEnabled = await telemetryService.isTelemetryEnabled();
      expect(telemetryEnabled).toEqual(true);

      await showTelemetryMessage(mockExtensionContext);
      expect(mShowInformation).toHaveBeenCalledTimes(1);
      expect(mShowInformation).toHaveBeenCalledWith(showMessage, showButtonText);
      expect(teleSpy.mock.calls[0]).toEqual([true]);
    });

    it('should not show telemetry info opt-out message nor internal message', async () => {
      // create telemetry shown states
      globalStateTelemetrySpy.mockImplementation(key => {
        return handleTelemetryMsgShown(key, true, true);
      });
      // mock out the isInternalHost call
      jest.spyOn(os, 'hostname').mockReturnValue('test.internal.salesforce.com');

      await telemetryService.initializeService(mockExtensionContext);

      const telemetryEnabled = await telemetryService.isTelemetryEnabled();
      expect(telemetryEnabled).toEqual(true);

      await showTelemetryMessage(mockExtensionContext);
      expect(globalStateTelemetrySpy).toHaveBeenCalledTimes(3);
      expect(globalStateTelemetrySpy).toHaveBeenCalledWith(TELEMETRY_GLOBAL_USER_ID);
      expect(globalStateTelemetrySpy).toHaveBeenCalledWith(TELEMETRY_GLOBAL_VALUE);
      expect(globalStateTelemetrySpy).toHaveBeenLastCalledWith(TELEMETRY_INTERNAL_VALUE);
      expect(mShowInformation).not.toHaveBeenCalled();
      expect(teleSpy.mock.calls[0]).toEqual([true]);
    });

    it('should show internal info message and telemetry opt-out message', async () => {
      // create telemetry shown states
      globalStateTelemetrySpy.mockImplementation(key => {
        return handleTelemetryMsgShown(key, false, false);
      });
      // mock out the isInternalHost call
      jest.spyOn(os, 'hostname').mockReturnValue('test.internal.salesforce.com');
      await telemetryService.initializeService(mockExtensionContext);

      const telemetryEnabled = await telemetryService.isTelemetryEnabled();
      expect(telemetryEnabled).toEqual(true);

      await showTelemetryMessage(mockExtensionContext);

      expect(mShowInformation).toHaveBeenCalledTimes(2);
      expect(mShowInformation).toHaveBeenCalledWith(internalMessage);
      expect(mShowInformation).toHaveBeenLastCalledWith(showMessage, showButtonText);
      expect(teleSpy.mock.calls[0]).toEqual([true]);
    });

    it('should show internal info message and not telemetry opt-out message', async () => {
      // create telemetry shown states
      globalStateTelemetrySpy.mockImplementation(key => {
        return handleTelemetryMsgShown(key, true, false);
      });
      // mock out the isInternalHost call
      jest.spyOn(os, 'hostname').mockReturnValue('test.internal.salesforce.com');

      await telemetryService.initializeService(mockExtensionContext);

      const telemetryEnabled = await telemetryService.isTelemetryEnabled();
      expect(telemetryEnabled).toEqual(true);

      await showTelemetryMessage(mockExtensionContext);

      expect(mShowInformation).toHaveBeenCalledTimes(1);
      expect(mShowInformation).toHaveBeenCalledWith(internalMessage);
      expect(mShowInformation).not.toHaveBeenCalledWith(showMessage, showButtonText);
      expect(teleSpy.mock.calls[0]).toEqual([true]);
    });

    it('should show internal info message and not telemetry opt-out message', async () => {
      // create telemetry shown states
      globalStateTelemetrySpy.mockImplementation(key => {
        return handleTelemetryMsgShown(key, true, false);
      });
      // mock out the isInternalHost call
      jest.spyOn(os, 'hostname').mockReturnValue('test.internal.salesforce.com');

      await telemetryService.initializeService(mockExtensionContext);

      const telemetryEnabled = await telemetryService.isTelemetryEnabled();
      expect(telemetryEnabled).toEqual(true);

      await showTelemetryMessage(mockExtensionContext);

      expect(mShowInformation).toHaveBeenCalledTimes(1);
      expect(mShowInformation).toHaveBeenCalledWith(internalMessage);
      expect(mShowInformation).not.toHaveBeenCalledWith(showMessage, showButtonText);
      expect(teleSpy.mock.calls[0]).toEqual([true]);
    });
  });

  describe('in dev mode', () => {
    it('should disable CLI telemetry', async () => {
      // create vscode extensionContext
      mockExtensionContext = new MockExtensionContext();
      jest.spyOn(extensions, 'getExtension').mockReturnValue(mockExtensionContext as unknown as Extension<any>);
      // mock out the isInternalHost call
      jest.spyOn(os, 'hostname').mockReturnValue('test-host');

      cliSpy.mockResolvedValue(false);
      await telemetryService.initializeService(mockExtensionContext);

      expect(teleSpy.mock.calls[0]).toEqual([false]);
    });
  });
});
