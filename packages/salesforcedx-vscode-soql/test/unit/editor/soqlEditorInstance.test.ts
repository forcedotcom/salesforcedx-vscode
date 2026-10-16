/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const mockRunPromise = vi.fn();
vi.mock('../../../src/services/extensionProvider', () => ({
  getSoqlRuntime: () => ({ runFork: vi.fn(), runPromise: mockRunPromise })
}));
vi.mock('../../../src/services/org', () => ({ isDefaultOrgSet: () => Promise.resolve(true) }));

import type { Mock as VitestMock } from 'vitest';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import * as queryPlan from '../../../src/commands/queryPlan';
import { SOQLEditorInstance } from '../../../src/editor/soqlEditorInstance';

describe('SOQL Builder Run Query', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends prepared SOQL while leaving header comments in the document', async () => {
    const text = '// header\nSELECT Id FROM Account;';
    const document = { getText: vi.fn(() => text) } as unknown as vscode.TextDocument;
    const query = vi.fn(() => Effect.succeed({ totalSize: 0, records: Stream.empty }));
    const servicesApi = {
      services: {
        SettingsService: Effect.succeed({ getValue: () => Effect.succeed(50) }),
        NotificationModeService: Effect.succeed({
          getProgressLocation: () => Effect.succeed(vscode.ProgressLocation.Notification)
        }),
        QueryService: Effect.succeed({ query })
      }
    };
    (vscode.extensions.getExtension as VitestMock).mockReturnValue({ isActive: true, exports: servicesApi });
    (vscode.window.withProgress as VitestMock).mockImplementation((_options: unknown, run: () => Promise<unknown>) =>
      run()
    );
    (vscode.workspace.onDidChangeTextDocument as VitestMock) = vi.fn();
    (vscode.workspace.applyEdit as VitestMock) = vi.fn();
    mockRunPromise.mockImplementation(effect =>
      Effect.runPromise(
        effect.pipe(
          Effect.provideService(ExtensionProviderService, { getServicesApi: Effect.succeed(servicesApi as never) })
        )
      )
    );
    const webviewPanel = {
      webview: { postMessage: vi.fn().mockResolvedValue(true) },
      onDidDispose: vi.fn()
    } as unknown as vscode.WebviewPanel;
    const instance = new SOQLEditorInstance(document, webviewPanel, {} as vscode.CancellationToken);
    vi.spyOn(
      instance as unknown as { openQueryDataView: (data: unknown) => Promise<void> },
      'openQueryDataView'
    ).mockResolvedValue(undefined);

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
    const executeQueryPlan = vi.spyOn(queryPlan, 'executeQueryPlan').mockImplementation(() => Effect.void as never);
    const document = { getText: () => '// header\nSELECT Id FROM Account;' } as vscode.TextDocument;
    const webviewPanel = {
      webview: { postMessage: vi.fn().mockResolvedValue(true) },
      onDidDispose: vi.fn()
    } as unknown as vscode.WebviewPanel;
    (vscode.workspace.onDidChangeTextDocument as VitestMock) = vi.fn();
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
