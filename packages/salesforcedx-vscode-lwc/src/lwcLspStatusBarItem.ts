/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LanguageStatusSeverity, languages, type Disposable, type LanguageStatusItem } from 'vscode';
import { nls } from './messages';

export default class LwcLspStatusBarItem implements Disposable {
  private languageStatusItem: LanguageStatusItem;

  constructor() {
    this.languageStatusItem = languages.createLanguageStatusItem('lwcLanguageServerStatus', [
      { language: 'html', pattern: '**/lwc/**' },
      { language: 'javascript', pattern: '**/lwc/**' },
      { language: 'typescript', pattern: '**/lwc/**' }
    ]);

    this.indexing();
  }

  public indexing() {
    this.languageStatusItem.text = nls.localize('lwc_language_server_loading');
    this.languageStatusItem.severity = LanguageStatusSeverity.Information;
  }

  public ready() {
    this.languageStatusItem.text = nls.localize('lwc_language_server_loaded');
    this.languageStatusItem.severity = LanguageStatusSeverity.Information;
  }

  public dispose() {
    this.languageStatusItem.dispose();
  }
}
