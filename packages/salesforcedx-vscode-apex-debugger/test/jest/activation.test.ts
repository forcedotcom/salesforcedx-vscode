/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { NotificationModeService } from 'salesforcedx-vscode-services/src/vscode/notificationModeService';
import * as vscode from 'vscode';
import { activateEffect } from '../../src/index';
import * as coreExtensionUtils from '../../src/utils/coreExtensionUtils';

jest.mock('../../src/utils/coreExtensionUtils', () => ({
  ...jest.requireActual('../../src/utils/coreExtensionUtils'),
  getTelemetryService: jest.fn()
}));

const registerCommandWithRuntime = jest.fn();
const notificationMode = {
  getProgressLocation: () => Effect.succeed(vscode.ProgressLocation.Notification),
  showSuccessNotification: () => Effect.void
} as unknown as NotificationModeService;

const extensionProviderLayer = () =>
  Layer.mergeAll(
    Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed({
        services: {
          registerCommandWithRuntime: () => registerCommandWithRuntime,
          NotificationModeService
        }
      })
    } as unknown as ExtensionProviderService),
    Layer.succeed(NotificationModeService, notificationMode)
  );

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
  let initializeService: jest.Mock;

  beforeEach(() => {
    registerCommandWithRuntime.mockReturnValue(Effect.void);
    initializeService = jest.fn(() => Promise.resolve());
    // resetMocks:true wipes the jest.mock factory impl each test — re-arm the telemetry stub
    (coreExtensionUtils.getTelemetryService as jest.Mock).mockResolvedValue({ initializeService });
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

    expect(registerCommandWithRuntime).toHaveBeenCalledWith('sf.debugger.stop', expect.anything());
    expect(registerCommandWithRuntime).toHaveBeenCalledWith('sf.debug.isv.bootstrap', expect.anything());
  });

  it('initializes telemetry', async () => {
    await runActivate();

    expect(initializeService).toHaveBeenCalledWith(extensionContext);
  });
});
