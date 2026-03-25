/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CancellationToken, CodeLens, EventEmitter, ExtensionContext, languages, Range, TextDocument } from 'vscode';
import { nls } from '../messages';
import { isDefaultOrgSet, onDefaultOrgChange } from '../services/org';

const SOQL_DOCUMENT_SELECTOR = { language: 'soql' };

const provideCodeLenses = async (document: TextDocument, _token: CancellationToken): Promise<CodeLens[]> => {
  if (document.getText().trim().length === 0 || !(await isDefaultOrgSet())) {
    return [];
  }
  return [
    new CodeLens(new Range(0, 0, 0, 0), {
      command: 'sf.data.query.explain.document',
      title: nls.localize('soql_query_plan_codelens'),
      tooltip: nls.localize('soql_query_plan_codelens')
    })
  ];
};

export const registerSoqlCodeLensProvider = (context: ExtensionContext): void => {
  const changeEmitter = new EventEmitter<void>();

  context.subscriptions.push(
    languages.registerCodeLensProvider(SOQL_DOCUMENT_SELECTOR, {
      onDidChangeCodeLenses: changeEmitter.event,
      provideCodeLenses
    }),
    onDefaultOrgChange(() => changeEmitter.fire()),
    changeEmitter
  );
};
