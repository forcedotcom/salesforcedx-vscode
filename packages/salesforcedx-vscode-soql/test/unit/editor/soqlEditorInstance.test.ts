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
import {
  ChannelService,
  NotificationModeService,
  PromptService,
  QueryService,
  SettingsService
} from '@salesforce/vscode-services/v2';
import * as vscode from 'vscode';
import * as queryPlan from '../../../src/commands/queryPlan';
import { SOQLEditorInstance } from '../../../src/editor/soqlEditorInstance';

describe('SOQL Builder Run Query', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends prepared SOQL while leaving header comments in the document', async () => {
    const text = '// header\nSELECT Id FROM Account;';
    const document = { getText: vi.fn(() => text) } as unknown as vscode.TextDocument;
    const query = vi.fn((_options: unknown, _decodePage: unknown) =>
      Effect.succeed({ totalSize: 0, records: Stream.empty })
    );
    const servicesApi = {
      v2: {
        services: { ChannelService, NotificationModeService, PromptService, QueryService, SettingsService }
      }
    };
    const serviceValues = {
      channel: { appendToChannel: () => Effect.void } as unknown as ChannelService['Service'],
      settings: { getValue: () => Effect.succeed(50) } as unknown as SettingsService['Service'],
      notificationMode: {
        getProgressLocation: () => Effect.succeed(vscode.ProgressLocation.Notification)
      } as unknown as NotificationModeService['Service'],
      prompt: {
        withProgress:
          () =>
          <A, E, R>(self: Effect.Effect<A, E, R>) =>
            self
      } as unknown as PromptService['Service'],
      query: { query } as unknown as QueryService['Service']
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
          Effect.provideService(ExtensionProviderService, { getServicesApi: Effect.succeed(servicesApi as never) }),
          Effect.provideService(ChannelService, serviceValues.channel),
          Effect.provideService(SettingsService, serviceValues.settings),
          Effect.provideService(NotificationModeService, serviceValues.notificationMode),
          Effect.provideService(PromptService, serviceValues.prompt),
          Effect.provideService(QueryService, serviceValues.query)
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
      instance['handleMessageEffect']({ type: 'run_query', payload: undefined as never }).pipe(
        Effect.provideService(ExtensionProviderService, { getServicesApi: Effect.succeed(servicesApi as never) })
      ) as Effect.Effect<unknown, unknown>
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
