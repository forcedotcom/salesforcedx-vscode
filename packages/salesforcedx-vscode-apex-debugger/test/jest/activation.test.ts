/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS } from '@salesforce/salesforcedx-apex-debugger';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import { UserCancellationError } from 'salesforcedx-vscode-services/src/vscode/prompts/promptService';
import * as vscode from 'vscode';
import { activateEffect, getExceptionBreakpointCache, type ExceptionBreakpointItem } from '../../src/index';

const registerCommandWithLayer = jest.fn();
const promptService = {
  considerUndefinedAsCancellation: <T>(value: T | undefined) =>
    value === undefined ? Effect.fail(new UserCancellationError()) : Effect.succeed(value)
};

const extensionProviderLayer = () =>
  Layer.succeed(ExtensionProviderService, {
    getServicesApi: Effect.succeed({
      services: {
        PromptService: Effect.succeed(promptService),
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

const runExceptionBreakpointCommand = async () => {
  await runActivate();
  const command = registerCommandWithLayer.mock.calls.find(
    ([commandId]) => commandId === 'sf.debug.exception.breakpoint'
  )?.[1] as () => Effect.Effect<void, unknown, ExtensionProviderService>;
  return Effect.runPromiseExit(
    command().pipe(Effect.provide(extensionProviderLayer())) as Effect.Effect<void, unknown, never>
  );
};

describe('activateEffect', () => {
  beforeEach(() => {
    getExceptionBreakpointCache().clear();
    registerCommandWithLayer.mockReturnValue(Effect.void);
    // registerCommands/registerDebugHandlers touch vscode.debug (absent from the shared mock) and
    // Disposable.from; stub just enough for the Effect.sync registration block to run.
    (vscode as unknown as { debug: Record<string, jest.Mock> }).debug = {
      onDidReceiveDebugSessionCustomEvent: jest.fn(),
      onDidStartDebugSession: jest.fn(),
      registerDebugConfigurationProvider: jest.fn()
    };
    (vscode.Disposable as unknown as { from: jest.Mock }).from = jest.fn();
    (vscode.extensions.getExtension as jest.Mock).mockReturnValue({
      isActive: true,
      exports: {
        getExceptionBreakpointInfo: jest.fn().mockResolvedValue([
          {
            label: 'System.Exception',
            typeref: 'System.Exception',
            breakMode: 'never'
          }
        ])
      }
    });
    (vscode.workspace.createFileSystemWatcher as jest.Mock).mockReturnValue({
      onDidChange: jest.fn(),
      onDidCreate: jest.fn(),
      onDidDelete: jest.fn()
    });
  });

  it('registers the Effect-based commands', async () => {
    await runActivate();

    expect(registerCommandWithLayer).toHaveBeenCalledWith('sf.debug.exception.breakpoint', expect.anything());
    expect(registerCommandWithLayer).toHaveBeenCalledWith('sf.debugger.stop', expect.anything());
    expect(registerCommandWithLayer).toHaveBeenCalledWith('sf.debug.isv.bootstrap', expect.anything());
  });

  it('fails with UserCancellationError when exception selection is dismissed', async () => {
    (vscode.window.showQuickPick as jest.Mock).mockResolvedValue(undefined);

    const exit = await runExceptionBreakpointCommand();

    expect(Exit.isFailure(exit) && exit.cause).toMatchObject({ error: { _tag: 'UserCancellationError' } });
  });

  it('fails with UserCancellationError when break mode selection is dismissed', async () => {
    (vscode.window.showQuickPick as jest.Mock)
      .mockResolvedValueOnce({ label: 'System.Exception', typeref: 'System.Exception', breakMode: 'never' })
      .mockResolvedValueOnce(undefined);

    const exit = await runExceptionBreakpointCommand();

    expect(Exit.isFailure(exit) && exit.cause).toMatchObject({ error: { _tag: 'UserCancellationError' } });
  });

  it('updates the breakpoint for successful selections', async () => {
    const selectedException: ExceptionBreakpointItem = {
      label: 'System.Exception',
      typeref: 'System.Exception',
      breakMode: 'never'
    };
    (vscode.window.showQuickPick as jest.Mock)
      .mockResolvedValueOnce(selectedException)
      .mockResolvedValueOnce({ label: 'Always', breakMode: EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS });

    const exit = await runExceptionBreakpointCommand();

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(getExceptionBreakpointCache().get('System.Exception')).toMatchObject({
      breakMode: EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS
    });
  });
});
