/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  CancellationToken,
  CodeLens,
  CodeLensProvider,
  EventEmitter,
  ExtensionContext,
  languages,
  TextDocument
} from 'vscode';

import { LWC_TEST_DOCUMENT_SELECTOR } from '../types/constants';
import { provideLwcTestCodeLens } from './provideLwcTestCodeLens';

/**
 * Code Lens Provider providing "Run Test" and "Debug Test" code lenses in LWC tests.
 */
class LwcTestCodeLensProvider implements CodeLensProvider {
  private onDidChangeCodeLensesEventEmitter = new EventEmitter<void>();
  public onDidChangeCodeLenses = this.onDidChangeCodeLensesEventEmitter.event;

  /**
   * Refresh code lenses
   */
  public refresh(): void {
    this.onDidChangeCodeLensesEventEmitter.fire();
  }

  /**
   * Invoked by VS Code to provide code lenses
   * @param document text document
   * @param token cancellation token
   */
  public async provideCodeLenses(document: TextDocument, token: CancellationToken): Promise<CodeLens[]> {
    return provideLwcTestCodeLens(document, token);
  }
}

export const lwcTestCodeLensProvider = new LwcTestCodeLensProvider();

/**
 * Register Code Lens Provider with the extension context
 * @param extensionContext Extension context
 */
export const registerLwcTestCodeLensProvider = (extensionContext: ExtensionContext) => {
  extensionContext.subscriptions.push(
    languages.registerCodeLensProvider(LWC_TEST_DOCUMENT_SELECTOR, lwcTestCodeLensProvider)
  );
};
