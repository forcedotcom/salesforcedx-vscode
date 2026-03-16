/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CancellationToken, CodeLens, ExtensionContext, languages, Range, TextDocument } from 'vscode';
import { nls } from '../messages';

const SOQL_DOCUMENT_SELECTOR = { language: 'soql' };

const provideRunQueryCodeLens = (document: TextDocument, _token: CancellationToken): CodeLens[] => {
  if (document.getText().trim().length === 0) {
    return [];
  }
  return [
    new CodeLens(new Range(0, 0, 0, 0), {
      command: 'sf.data.query.document',
      title: nls.localize('soql_run_query_codelens'),
      tooltip: nls.localize('soql_run_query_codelens')
    })
  ];
};

export const registerSoqlCodeLensProvider = (context: ExtensionContext): void => {
  context.subscriptions.push(
    languages.registerCodeLensProvider(SOQL_DOCUMENT_SELECTOR, {
      provideCodeLenses: provideRunQueryCodeLens
    })
  );
};
