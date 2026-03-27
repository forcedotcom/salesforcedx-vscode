/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import AuraLspStatusBarItem from '../../src/auraLspStatusBarItem';
import { nls } from '../../src/messages';

jest.mock('vscode');

describe('AuraLspStatusBarItem', () => {
  let statusBarItem: AuraLspStatusBarItem;
  let mockLanguageStatusItem: vscode.LanguageStatusItem;

  beforeEach(() => {
    mockLanguageStatusItem = {
      text: '',
      severity: vscode.LanguageStatusSeverity.Information,
      command: undefined,
      dispose: jest.fn()
    } as unknown as vscode.LanguageStatusItem;

    jest.spyOn(vscode.languages, 'createLanguageStatusItem').mockReturnValue(mockLanguageStatusItem);

    statusBarItem = new AuraLspStatusBarItem();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('initialization', () => {
    it('should create language status item scoped to Aura file patterns', () => {
      expect(vscode.languages.createLanguageStatusItem).toHaveBeenCalledWith('auraLanguageServerStatus', [
        { language: 'html', pattern: '**/aura/**' },
        { language: 'javascript', pattern: '**/aura/**' }
      ]);
    });

    it('should set indexing status on creation', () => {
      expect(mockLanguageStatusItem.text).toBe(nls.localize('aura_language_server_loading'));
      expect(mockLanguageStatusItem.severity).toBe(vscode.LanguageStatusSeverity.Information);
    });
  });

  describe('status updates', () => {
    it('should update status when indexing', () => {
      statusBarItem.indexing();
      expect(mockLanguageStatusItem.text).toBe(nls.localize('aura_language_server_loading'));
      expect(mockLanguageStatusItem.severity).toBe(vscode.LanguageStatusSeverity.Information);
    });

    it('should update status when ready', () => {
      statusBarItem.ready();
      expect(mockLanguageStatusItem.text).toBe(nls.localize('aura_language_server_loaded'));
      expect(mockLanguageStatusItem.severity).toBe(vscode.LanguageStatusSeverity.Information);
    });
  });

  describe('disposal', () => {
    it('should dispose language status item', () => {
      statusBarItem.dispose();
      expect(mockLanguageStatusItem.dispose).toHaveBeenCalled();
    });
  });
});
