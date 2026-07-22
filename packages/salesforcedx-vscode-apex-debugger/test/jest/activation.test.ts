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
import * as isvContext from '../../src/context/isvContext';
import { activateEffect } from '../../src/index';
import * as coreExtensionUtils from '../../src/utils/coreExtensionUtils';

jest.mock('../../src/utils/coreExtensionUtils', () => ({
  ...jest.requireActual('../../src/utils/coreExtensionUtils'),
  getTelemetryService: jest.fn()
}));

// stub api.services.TerminalService: yielding it gives an object whose `simpleExec` (for `sf --version`)
// succeeds when the CLI is installed and fails with TerminalServiceError when absent — the activation's
// own catchTag folds that failure into the false branch. Matches the accessors:false resolve-then-call pattern.
const extensionProviderLayer = (isCliInstalled: boolean) =>
  Layer.succeed(ExtensionProviderService, {
    getServicesApi: Effect.succeed({
      services: {
        // activation registers sf.debugger.stop via registerCommandWithLayer; stub it to a no-op Effect
        registerCommandWithLayer: () => () => Effect.void,
        TerminalService: Effect.succeed({
          // catchTag in the activation matches on `_tag`, so a tagged failure object is enough (the real
          // TerminalServiceError is a type-only export of the services barrel).
          simpleExec: () =>
            isCliInstalled
              ? Effect.succeed(true)
              : Effect.fail({ _tag: 'TerminalServiceError', message: 'command not found: sf', command: 'sf --version' })
        })
      }
    })
  } as unknown as ExtensionProviderService);

const extensionContext = { subscriptions: { push: jest.fn() } } as unknown as vscode.ExtensionContext;

const runActivate = (isCliInstalled: boolean) =>
  Effect.runPromise(
    activateEffect(extensionContext).pipe(Effect.provide(extensionProviderLayer(isCliInstalled))) as Effect.Effect<
      void,
      unknown,
      never
    >
  );

describe('activateEffect ISV setup gate', () => {
  let registerSpy: jest.SpyInstance;
  let setupSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    registerSpy = jest.spyOn(isvContext, 'registerIsvAuthWatcher').mockImplementation(() => undefined);
    setupSpy = jest.spyOn(isvContext, 'setupGlobalDefaultUserIsvAuth').mockResolvedValue(undefined);
    // resetMocks:true wipes the jest.mock factory impl each test — re-arm the telemetry stub
    (coreExtensionUtils.getTelemetryService as jest.Mock).mockResolvedValue({
      initializeService: jest.fn(() => Promise.resolve())
    });
    warnSpy = (vscode.window.showWarningMessage as jest.Mock).mockClear();
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs ISV setup when the CLI is installed', async () => {
    await runActivate(true);
    expect(registerSpy).toHaveBeenCalledWith(extensionContext);
    expect(setupSpy).toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('skips ISV setup when the CLI is not installed', async () => {
    await runActivate(false);
    expect(registerSpy).not.toHaveBeenCalled();
    expect(setupSpy).not.toHaveBeenCalled();
  });

  it('catches a rejecting setup (warning shown, fiber succeeds)', async () => {
    setupSpy.mockRejectedValue(new Error('boom'));
    await expect(runActivate(true)).resolves.not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
  });
});
