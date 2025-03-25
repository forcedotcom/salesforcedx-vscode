/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import ApexLSPStatusBarItem from '../../../src/apexLspStatusBarItem';
import { nls } from '../../../src/messages';

// Mock the nls.localize function
jest.mock('../../../src/messages', () => ({
  nls: {
    localize: jest.fn().mockImplementation(key => key)
  }
}));

jest.mock('vscode');

describe('ApexLSPStatusBarItem', () => {
  let statusBarItem: ApexLSPStatusBarItem;
  let createLanguageStatusItemMock: jest.SpyInstance;
  let createDiagnosticCollectionMock: jest.SpyInstance;
  let setMock: jest.SpyInstance;
  let uriFileMock: jest.SpyInstance;

  beforeEach(() => {
    createLanguageStatusItemMock = jest.spyOn(vscode.languages, 'createLanguageStatusItem').mockReturnValue({
      text: '',
      severity: vscode.LanguageStatusSeverity.Information,
      command: undefined,
      dispose: jest.fn()
    } as unknown as vscode.LanguageStatusItem);

    createDiagnosticCollectionMock = jest.spyOn(vscode.languages, 'createDiagnosticCollection').mockReturnValue({
      set: jest.fn((uri, diagnostics) => {
        // Mock implementation that preserves the diagnostic objects
        return Promise.resolve();
      })
    } as unknown as vscode.DiagnosticCollection);

    uriFileMock = jest.spyOn(vscode.Uri, 'file').mockReturnValue({
      fsPath: '/ApexLSP'
    } as unknown as vscode.Uri);

    statusBarItem = new ApexLSPStatusBarItem();
    setMock = jest.spyOn(statusBarItem['diagnostics'], 'set');
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
      expect(vscode.languages.createDiagnosticCollection).toHaveBeenCalledWith('apex');
    });
  });

  describe('error handling', () => {
    it('should set error message and diagnostic with correct severity', () => {
      const errorMessage = 'Test error message';

      statusBarItem.error(errorMessage);

      // Verify language status item is updated
      expect(statusBarItem['languageStatusItem'].text).toBe(errorMessage);
      expect(statusBarItem['languageStatusItem'].severity).toBe(vscode.LanguageStatusSeverity.Error);

      // Verify diagnostic is created with correct properties
      expect(vscode.Uri.file).toHaveBeenCalledWith('/ApexLSP');

      const setCall = (statusBarItem['diagnostics'].set as jest.Mock).mock.calls[0];
      expect(setCall[0]).toBeDefined();
      expect(setCall[1]).toHaveLength(1);
      expect(setCall[1][0]).toBeInstanceOf(vscode.Diagnostic);
      //we don't bother checking the errorMessage and severity because we're not testing the Diagnostic class
    });
  });

  describe('status updates', () => {
    it('should update status when indexing', () => {
      statusBarItem.indexing();
      expect(nls.localize).toHaveBeenCalledWith('apex_language_server_loading');
      expect(statusBarItem['languageStatusItem'].severity).toBe(vscode.LanguageStatusSeverity.Information);
    });

    it('should update status when ready', () => {
      statusBarItem.ready();
      expect(nls.localize).toHaveBeenCalledWith('apex_language_server_loaded');
      expect(statusBarItem['languageStatusItem'].severity).toBe(vscode.LanguageStatusSeverity.Information);
      expect(statusBarItem['languageStatusItem'].command).toBeDefined();
    });

    it('should update status when restarting', () => {
      statusBarItem.restarting();
      expect(nls.localize).toHaveBeenCalledWith('apex_language_server_restarting');
      expect(statusBarItem['languageStatusItem'].command).toBeUndefined();
    });
  });

  describe('disposal', () => {
    it('should dispose language status item', () => {
      const mockDispose = jest.fn();
      statusBarItem['languageStatusItem'].dispose = mockDispose;

      statusBarItem.dispose();
      expect(mockDispose).toHaveBeenCalled();
    });
  });
});
