/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ExtensionProviderService as ExtensionProviderServiceType } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';
import type { SettingsService as SettingsServiceType } from 'salesforcedx-vscode-services/src/vscode/settingsService';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import ApexLSPStatusBarItem from '../../../src/apexLspStatusBarItem';
import { nls } from '../../../src/messages';

jest.mock('vscode');
const mockGetRestartBehavior = jest.fn((_section: string, _key: string, defaultValue?: unknown) =>
  Effect.succeed(defaultValue)
);
jest.mock('../../../src/services/runtime', () => {
  const effect = require('effect/Effect') as typeof Effect;
  const { ExtensionProviderService } = require('@salesforce/effect-ext-utils') as {
    ExtensionProviderService: typeof ExtensionProviderServiceType;
  };
  const { SettingsService } = require('salesforcedx-vscode-services/src/vscode/settingsService') as {
    SettingsService: typeof SettingsServiceType;
  };
  const settingsService = {
    getValue: (...args: [string, string, unknown?]) => mockGetRestartBehavior(...args),
    getValueOrElse: (...args: [string, string, unknown?]) => mockGetRestartBehavior(...args)
  };
  return {
    getRuntime: () => ({
      runFork: (eff: Effect.Effect<unknown, unknown>) =>
        effect.runFork(
          eff.pipe(
            effect.provideService(ExtensionProviderService, {
              getServicesApi: effect.succeed({
                services: { SettingsService }
              } as SalesforceVSCodeServicesApi)
            }),
            effect.provideService(SettingsService, SettingsService.make(settingsService as never))
          )
        )
    })
  };
});

describe('ApexLSPStatusBarItem', () => {
  let statusBarItem: ApexLSPStatusBarItem;
  let setMock: jest.SpyInstance;
  let mockLanguageStatusItem: vscode.LanguageStatusItem;
  let mockRestartStatusItem: vscode.LanguageStatusItem;

  beforeEach(() => {
    mockGetRestartBehavior.mockImplementation((_section, _key, defaultValue) => Effect.succeed(defaultValue));
    mockLanguageStatusItem = {
      text: '',
      severity: vscode.LanguageStatusSeverity.Information,
      command: undefined,
      dispose: jest.fn()
    } as unknown as vscode.LanguageStatusItem;

    mockRestartStatusItem = {
      text: '',
      severity: vscode.LanguageStatusSeverity.Information,
      command: undefined,
      dispose: jest.fn()
    } as unknown as vscode.LanguageStatusItem;

    jest.spyOn(vscode.languages, 'createLanguageStatusItem').mockImplementation(id => {
      if (id === 'ApexLSPLanguageStatusItem') {
        return mockLanguageStatusItem;
      }
      return mockRestartStatusItem;
    });

    jest.spyOn(vscode.languages, 'createDiagnosticCollection').mockReturnValue({
      set: jest.fn(() => Promise.resolve()),
      dispose: jest.fn()
    } as unknown as vscode.DiagnosticCollection);

    jest.spyOn(URI, 'file').mockReturnValue({
      fsPath: '/ApexLSP'
    } as unknown as URI);

    statusBarItem = new ApexLSPStatusBarItem();
    setMock = jest.spyOn(statusBarItem['diagnostics'], 'set');

    // Initialize disposables array with the diagnostic collection
    statusBarItem['disposables'] = [statusBarItem['diagnostics']];
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('initialization', () => {
    it('should create language status item and diagnostic collection', () => {
      expect(vscode.languages.createLanguageStatusItem).toHaveBeenCalledWith('ApexLSPLanguageStatusItem', {
        language: 'apex',
        scheme: 'file'
      });
      expect(vscode.languages.createLanguageStatusItem).toHaveBeenCalledWith('ApexLSPRestartStatusItem', {
        language: 'apex',
        scheme: 'file'
      });
      expect(vscode.languages.createDiagnosticCollection).toHaveBeenCalledWith('apex');
    });
  });

  describe('error handling', () => {
    it('should set error message and diagnostic with correct severity', () => {
      const errorMessage = 'Test error message';

      statusBarItem.error(errorMessage);

      // Verify language status item is updated
      expect(mockLanguageStatusItem.text).toBe(errorMessage);
      expect(mockLanguageStatusItem.severity).toBe(vscode.LanguageStatusSeverity.Error);

      // Verify diagnostic is created with correct properties
      expect(URI.file).toHaveBeenCalledWith('/ApexLSP');
      expect(setMock).toHaveBeenCalled();
    });
  });

  describe('status updates', () => {
    it('should update status when indexing', () => {
      statusBarItem.indexing();
      expect(mockLanguageStatusItem.text).toBe(nls.localize('apex_language_server_loading'));
      expect(mockLanguageStatusItem.severity).toBe(vscode.LanguageStatusSeverity.Information);
    });

    it('should update status when ready', () => {
      statusBarItem.ready();
      expect(mockLanguageStatusItem.text).toBe(nls.localize('apex_language_server_loaded'));
      expect(mockLanguageStatusItem.severity).toBe(vscode.LanguageStatusSeverity.Information);
      expect(mockRestartStatusItem.command).toBeDefined();
    });

    it('should update status when restarting', () => {
      statusBarItem.restarting();
      expect(mockLanguageStatusItem.text).toBe(nls.localize('apex_language_server_restarting'));
      expect(mockLanguageStatusItem.severity).toBe(vscode.LanguageStatusSeverity.Information);
      expect(mockRestartStatusItem.command).toBeUndefined();
    });
  });

  describe('disposal', () => {
    it('should dispose language status items', () => {
      statusBarItem.dispose();
      expect(mockLanguageStatusItem.dispose).toHaveBeenCalled();
      expect(mockRestartStatusItem.dispose).toHaveBeenCalled();
    });
  });
});
