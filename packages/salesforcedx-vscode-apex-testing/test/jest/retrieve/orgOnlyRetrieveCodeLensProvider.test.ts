/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import {
  provideOrgOnlyRetrieveCodeLenses,
  registerOrgOnlyRetrieveCodeLensProvider
} from '../../../src/retrieve/orgOnlyRetrieveCodeLensProvider';

describe('orgOnlyRetrieveCodeLensProvider', () => {
  beforeEach(() => {
    (vscode.languages as typeof vscode.languages & { registerCodeLensProvider: jest.Mock }).registerCodeLensProvider =
      jest.fn(() => ({ dispose: jest.fn() }));
  });

  it('provides a retrieve codelens for org metadata documents', () => {
    const document = {
      uri: URI.parse('sf-org-metadata:/orgs/org123/ApexClass/ns%2FMyClass.cls')
    } as unknown as vscode.TextDocument;

    const lenses = provideOrgOnlyRetrieveCodeLenses(document);
    expect(lenses).toHaveLength(1);
    expect(lenses[0].command?.command).toBe('sf.apex.test.orgOnlyClass.retrieve');
    expect(lenses[0].command?.arguments).toEqual([document.uri]);
  });

  it('registers codelens provider with the org metadata apex selector', () => {
    const context = {
      subscriptions: [] as vscode.Disposable[]
    } as unknown as vscode.ExtensionContext;

    registerOrgOnlyRetrieveCodeLensProvider(context);

    expect(
      (vscode.languages as typeof vscode.languages & { registerCodeLensProvider: jest.Mock }).registerCodeLensProvider
    ).toHaveBeenCalledWith(
      { language: 'apex', scheme: 'sf-org-metadata' },
      expect.objectContaining({ provideCodeLenses: expect.any(Function) })
    );
    expect(context.subscriptions).toHaveLength(1);
  });
});
