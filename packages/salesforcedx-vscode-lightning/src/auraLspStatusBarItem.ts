/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LanguageStatusSeverity, languages, type Disposable, type LanguageStatusItem } from 'vscode';
import { nls } from './messages';

export default class AuraLspStatusBarItem implements Disposable {
  private languageStatusItem: LanguageStatusItem;

  constructor() {
    this.languageStatusItem = languages.createLanguageStatusItem('auraLanguageServerStatus', [
      { language: 'html', pattern: '**/aura/**' },
      { language: 'javascript', pattern: '**/aura/**' }
    ]);

    this.indexing();
  }

  public indexing() {
    this.languageStatusItem.text = nls.localize('aura_language_server_loading');
    this.languageStatusItem.severity = LanguageStatusSeverity.Information;
  }

  public ready() {
    this.languageStatusItem.text = nls.localize('aura_language_server_loaded');
    this.languageStatusItem.severity = LanguageStatusSeverity.Information;
  }

  public dispose() {
    this.languageStatusItem.dispose();
  }
}
