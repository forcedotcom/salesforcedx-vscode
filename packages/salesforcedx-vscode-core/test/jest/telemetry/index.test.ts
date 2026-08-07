/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  TELEMETRY_GLOBAL_USER_ID,
  TELEMETRY_GLOBAL_WEB_USER_ID,
  TelemetryService
} from '@salesforce/salesforcedx-utils-vscode';
import * as os from 'node:os';
import { window, workspace } from 'vscode';
import { TELEMETRY_GLOBAL_VALUE, TELEMETRY_INTERNAL_VALUE, TELEMETRY_OPT_OUT_LINK } from '../../../src/constants';
import { nls } from '../../../src/messages';
import { SalesforceCoreSettings } from '../../../src/settings/salesforceCoreSettings';
import { showTelemetryMessage, telemetryService } from '../../../src/telemetry';
import { MockExtensionContext } from './MockExtensionContext';

describe('Telemetry', () => {
  let mShowInformation: jest.SpyInstance;
  let mockExtensionContext: MockExtensionContext;

  beforeEach(() => {
    mShowInformation = jest.spyOn(window, 'showInformationMessage').mockResolvedValue(undefined);
    jest.spyOn(SalesforceCoreSettings.prototype, 'getTelemetryEnabled').mockReturnValue(true);
    jest.spyOn(telemetryService, 'checkCliTelemetry').mockResolvedValue(true);
    jest.spyOn(telemetryService as TelemetryService, 'getIdentityFromServices').mockResolvedValue({
      cliId: 'cli',
      webUserId: 'web',
      telemetryClassification: 'nonGov'
    });

    // Mock createFileSystemWatcher to return a proper mock object
    jest.spyOn(workspace, 'createFileSystemWatcher').mockReturnValue({
      onDidChange: jest.fn(),
      onDidCreate: jest.fn(),
      onDidDelete: jest.fn(),
      dispose: jest.fn()
    } as any);
    // Telemetry now sources identity from services API; mock the degraded-session channel write.
    jest.spyOn(window, 'createOutputChannel').mockReturnValue({
      appendLine: jest.fn(),
      append: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      clear: jest.fn(),
      dispose: jest.fn(),
      replace: jest.fn(),
      name: 'mock'
    } as any);
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
      if (key === TELEMETRY_GLOBAL_WEB_USER_ID) {
        return undefined;
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
      globalStateTelemetrySpy.mockImplementation(key => handleTelemetryMsgShown(key, false, false));
      // mock out the isInternalHost call
      jest.spyOn(os, 'hostname').mockReturnValue('test-host');

      await telemetryService.initializeService(mockExtensionContext);

      const telemetryEnabled = await telemetryService.isTelemetryEnabled();
      expect(telemetryEnabled).toBe(true);

      await showTelemetryMessage(mockExtensionContext);
      expect(mShowInformation).toHaveBeenCalledTimes(1);
      expect(mShowInformation).toHaveBeenCalledWith(showMessage, showButtonText);
    });

    it('should not show telemetry info opt-out message nor internal message', async () => {
      // create telemetry shown states
      globalStateTelemetrySpy.mockImplementation(key => handleTelemetryMsgShown(key, true, true));
      // mock out the isInternalHost call
      jest.spyOn(os, 'hostname').mockReturnValue('test.internal.salesforce.com');

      await telemetryService.initializeService(mockExtensionContext);

      const telemetryEnabled = await telemetryService.isTelemetryEnabled();
      expect(telemetryEnabled).toBe(true);

      await showTelemetryMessage(mockExtensionContext);
      // Identity now sourced from services extension; only the show-message keys are read from globalState.
      expect(globalStateTelemetrySpy).toHaveBeenCalledWith(TELEMETRY_GLOBAL_VALUE);
      expect(globalStateTelemetrySpy).toHaveBeenLastCalledWith(TELEMETRY_INTERNAL_VALUE);
      expect(mShowInformation).not.toHaveBeenCalled();
    });

    it('should show internal info message and telemetry opt-out message', async () => {
      // create telemetry shown states
      globalStateTelemetrySpy.mockImplementation(key => handleTelemetryMsgShown(key, false, false));
      // mock out the isInternalHost call
      jest.spyOn(os, 'hostname').mockReturnValue('test.internal.salesforce.com');
      await telemetryService.initializeService(mockExtensionContext);

      const telemetryEnabled = await telemetryService.isTelemetryEnabled();
      expect(telemetryEnabled).toBe(true);

      await showTelemetryMessage(mockExtensionContext);

      expect(mShowInformation).toHaveBeenCalledTimes(2);
      expect(mShowInformation).toHaveBeenCalledWith(internalMessage);
      expect(mShowInformation).toHaveBeenLastCalledWith(showMessage, showButtonText);
    });

    it('should show internal info message and not telemetry opt-out message', async () => {
      // create telemetry shown states
      globalStateTelemetrySpy.mockImplementation(key => handleTelemetryMsgShown(key, true, false));
      // mock out the isInternalHost call
      jest.spyOn(os, 'hostname').mockReturnValue('test.internal.salesforce.com');

      await telemetryService.initializeService(mockExtensionContext);

      const telemetryEnabled = await telemetryService.isTelemetryEnabled();
      expect(telemetryEnabled).toBe(true);

      await showTelemetryMessage(mockExtensionContext);

      expect(mShowInformation).toHaveBeenCalledTimes(1);
      expect(mShowInformation).toHaveBeenCalledWith(internalMessage);
      expect(mShowInformation).not.toHaveBeenCalledWith(showMessage, showButtonText);
    });
  });
});
