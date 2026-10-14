/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const mockRunPromise = jest.fn();
jest.mock('../../../src/services/extensionProvider', () => ({
  getSoqlRuntime: () => ({ runFork: jest.fn(), runPromise: mockRunPromise })
}));
jest.mock('../../../src/services/org', () => ({ isDefaultOrgSet: () => Promise.resolve(true) }));

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import * as queryPlan from '../../../src/commands/queryPlan';
import { SOQLEditorInstance } from '../../../src/editor/soqlEditorInstance';

describe('SOQL Builder Run Query', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends prepared SOQL while leaving header comments in the document', async () => {
    const text = '// header\nSELECT Id FROM Account;';
    const document = { getText: jest.fn(() => text) } as unknown as vscode.TextDocument;
    const query = jest.fn(() => Effect.succeed({ totalSize: 0, records: Stream.empty }));
    const servicesApi = {
      services: {
        SettingsService: Effect.succeed({ getValue: () => Effect.succeed(50) }),
        NotificationModeService: Effect.succeed({
          getProgressLocation: () => Effect.succeed(vscode.ProgressLocation.Notification)
        }),
        QueryService: Effect.succeed({ query })
      }
    };
    (vscode.extensions.getExtension as jest.Mock).mockReturnValue({ isActive: true, exports: servicesApi });
    (vscode.window.withProgress as jest.Mock).mockImplementation((_options: unknown, run: () => Promise<unknown>) =>
      run()
    );
    (vscode.workspace.onDidChangeTextDocument as jest.Mock) = jest.fn();
    (vscode.workspace.applyEdit as jest.Mock) = jest.fn();
    mockRunPromise.mockImplementation(effect =>
      Effect.runPromise(
        effect.pipe(
          Effect.provideService(ExtensionProviderService, { getServicesApi: Effect.succeed(servicesApi as never) })
        )
      )
    );
    const webviewPanel = {
      webview: { postMessage: jest.fn().mockResolvedValue(true) },
      onDidDispose: jest.fn()
    } as unknown as vscode.WebviewPanel;
    const instance = new SOQLEditorInstance(document, webviewPanel, {} as vscode.CancellationToken);
    jest
      .spyOn(instance as unknown as { openQueryDataView: (data: unknown) => Promise<void> }, 'openQueryDataView')
      .mockResolvedValue(undefined);

    await Effect.runPromise(
      instance['handleMessageEffect']({ type: 'run_query', payload: undefined as never }) as Effect.Effect<
        unknown,
        unknown
      >
    );

    expect(query).toHaveBeenCalledWith({ soql: 'SELECT Id FROM Account', scanAll: false }, expect.anything());
    expect(document.getText()).toBe(text);
    expect(vscode.workspace.applyEdit).not.toHaveBeenCalled();
  });

  it('passes prepared SOQL to the Builder query plan', async () => {
    const executeQueryPlan = jest.spyOn(queryPlan, 'executeQueryPlan').mockImplementation(() => Effect.void as never);
    const document = { getText: () => '// header\nSELECT Id FROM Account;' } as vscode.TextDocument;
    const webviewPanel = {
      webview: { postMessage: jest.fn().mockResolvedValue(true) },
      onDidDispose: jest.fn()
    } as unknown as vscode.WebviewPanel;
    (vscode.workspace.onDidChangeTextDocument as jest.Mock) = jest.fn();
    mockRunPromise.mockImplementation(effect => Effect.runPromise(effect));
    const instance = new SOQLEditorInstance(document, webviewPanel, {} as vscode.CancellationToken);

    await Effect.runPromise(
      instance['handleMessageEffect']({ type: 'get_query_plan', payload: undefined as never }) as Effect.Effect<
        unknown,
        unknown
      >
    );

    expect(executeQueryPlan).toHaveBeenCalledWith('SELECT Id FROM Account');
  });
});
