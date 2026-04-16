/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { nls } from '../messages';

const ORG_ONLY_APEX_SELECTOR: vscode.DocumentSelector = {
  language: 'apex',
  scheme: 'apex-testing'
};

export const provideOrgOnlyRetrieveCodeLenses = (document: vscode.TextDocument): vscode.CodeLens[] => {
  const title = nls.localize('apex_test_retrieve_org_only_class_codelens_text');
  const codeLens = new vscode.CodeLens(new vscode.Range(0, 0, 0, 0));
  codeLens.command = {
    command: 'sf.apex.test.orgOnlyClass.retrieve',
    title,
    tooltip: title,
    arguments: [document.uri]
  };
  return [codeLens];
};

export const registerOrgOnlyRetrieveCodeLensProvider = (context: vscode.ExtensionContext): void => {
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(ORG_ONLY_APEX_SELECTOR, {
      provideCodeLenses: document => provideOrgOnlyRetrieveCodeLenses(document)
    })
  );
};
