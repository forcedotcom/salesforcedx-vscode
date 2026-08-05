/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { activateEffect } from '../../src/index';

const registerCommandWithLayer = jest.fn();

const extensionProviderLayer = () =>
  Layer.succeed(ExtensionProviderService, {
    getServicesApi: Effect.succeed({
      services: {
        registerCommandWithLayer: () => registerCommandWithLayer
      }
    })
  } as unknown as ExtensionProviderService);

const extensionContext = { subscriptions: { push: jest.fn() } } as unknown as vscode.ExtensionContext;

const runActivate = () =>
  Effect.runPromise(
    activateEffect(extensionContext).pipe(Effect.provide(extensionProviderLayer())) as Effect.Effect<
      void,
      unknown,
      never
    >
  );

describe('activateEffect', () => {
  beforeEach(() => {
    registerCommandWithLayer.mockReturnValue(Effect.void);
    // registerCommands/registerDebugHandlers touch vscode.debug (absent from the shared mock) and
    // Disposable.from; stub just enough for the Effect.sync registration block to run.
    (vscode as unknown as { debug: Record<string, jest.Mock> }).debug = {
      onDidReceiveDebugSessionCustomEvent: jest.fn(),
      onDidStartDebugSession: jest.fn(),
      registerDebugConfigurationProvider: jest.fn()
    };
    (vscode.Disposable as unknown as { from: jest.Mock }).from = jest.fn();
    (vscode.workspace.createFileSystemWatcher as jest.Mock).mockReturnValue({
      onDidChange: jest.fn(),
      onDidCreate: jest.fn(),
      onDidDelete: jest.fn()
    });
  });

  it('registers the Effect-based commands', async () => {
    await runActivate();

    expect(registerCommandWithLayer).toHaveBeenCalledWith('sf.debugger.stop', expect.anything());
    expect(registerCommandWithLayer).toHaveBeenCalledWith('sf.debug.isv.bootstrap', expect.anything());
  });
});
