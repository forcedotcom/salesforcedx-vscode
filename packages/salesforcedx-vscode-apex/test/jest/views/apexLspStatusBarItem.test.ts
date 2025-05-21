/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
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
  let mockLanguageStatusItem: vscode.LanguageStatusItem;
  let mockRestartStatusItem: vscode.LanguageStatusItem;

  beforeEach(() => {
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

    createLanguageStatusItemMock = jest.spyOn(vscode.languages, 'createLanguageStatusItem').mockImplementation(id => {
      if (id === 'ApexLSPLanguageStatusItem') {
        return mockLanguageStatusItem;
      }
      return mockRestartStatusItem;
    });

    createDiagnosticCollectionMock = jest.spyOn(vscode.languages, 'createDiagnosticCollection').mockReturnValue({
      set: jest.fn(() => Promise.resolve()),
      dispose: jest.fn()
    } as unknown as vscode.DiagnosticCollection);

    uriFileMock = jest.spyOn(URI, 'file').mockReturnValue({
      fsPath: '/ApexLSP'
    } as unknown as URI);

    statusBarItem = new ApexLSPStatusBarItem();
    setMock = jest.spyOn(statusBarItem['diagnostics'], 'set');

    // Initialize disposables array with the diagnostic collection
    statusBarItem['disposables'] = [statusBarItem['diagnostics']];

    // Verify mocks were created successfully
    expect(createLanguageStatusItemMock).toBeDefined();
    expect(createDiagnosticCollectionMock).toBeDefined();
    expect(uriFileMock).toBeDefined();
    expect(setMock).toBeDefined();
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
      expect(nls.localize).toHaveBeenCalledWith('apex_language_server_loading');
      expect(mockLanguageStatusItem.severity).toBe(vscode.LanguageStatusSeverity.Information);
    });

    it('should update status when ready', () => {
      statusBarItem.ready();
      expect(nls.localize).toHaveBeenCalledWith('apex_language_server_loaded');
      expect(mockLanguageStatusItem.severity).toBe(vscode.LanguageStatusSeverity.Information);
      expect(mockLanguageStatusItem.command).toBeUndefined();
    });

    it('should update status when restarting', () => {
      statusBarItem.restarting();
      expect(nls.localize).toHaveBeenCalledWith('apex_language_server_restarting');
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
