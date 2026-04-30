/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  LanguageStatusSeverity,
  languages,
  type Disposable,
  type DocumentSelector,
  type LanguageStatusItem
} from 'vscode';
import { nls } from './messages';

/** LWC bundle paths; virtual / test-web URIs may not glob-match the usual `lwc` path segment pattern. */
const lwcDocumentSelector: DocumentSelector = [
  { language: 'html', pattern: '**/lwc/**' },
  { language: 'javascript', pattern: '**/lwc/**' },
  { language: 'typescript', pattern: '**/lwc/**' }
];

/**
 * Web: broaden selectors so language status still binds when workspace FS paths do not match the `lwc` glob.
 * The LWC extension only activates for LWC workspaces (`autodetect` / `always`), so extra `language` filters
 * do not affect unrelated project types.
 */
const languageStatusSelector: DocumentSelector =
  process.env.ESBUILD_PLATFORM === 'web'
    ? [...lwcDocumentSelector, { language: 'html' }, { language: 'javascript' }, { language: 'typescript' }]
    : lwcDocumentSelector;

export default class LwcLspStatusBarItem implements Disposable {
  private languageStatusItem: LanguageStatusItem;

  constructor() {
    this.languageStatusItem = languages.createLanguageStatusItem('lwcLanguageServerStatus', languageStatusSelector);

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
