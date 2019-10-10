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

import { provideLwcTestCodeLens } from './provideLwcTestCodeLens';

class LwcTestCodeLensProvider implements CodeLensProvider {
  private onDidChangeCodeLensesEventEmitter = new EventEmitter<void>();
  public onDidChangeCodeLenses = this.onDidChangeCodeLensesEventEmitter.event;

  public refresh(): void {
    this.onDidChangeCodeLensesEventEmitter.fire();
  }

  public async provideCodeLenses(
    document: TextDocument,
    token: CancellationToken
  ): Promise<CodeLens[]> {
    return provideLwcTestCodeLens(document, token);
  }
}

export const lwcTestCodeLensProvider = new LwcTestCodeLensProvider();

export function registerLwcTestCodeLensProvider(context: ExtensionContext) {
  context.subscriptions.push(
    languages.registerCodeLensProvider(
      {
        language: 'javascript',
        pattern: '**/lwc/**/*.test.js'
      },
      lwcTestCodeLensProvider
    )
  );
}
