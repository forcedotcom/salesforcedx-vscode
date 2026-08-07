/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import * as Effect from 'effect/Effect';
import {
  getInternalMode,
  normalizeToInternal,
  NotificationModeService
} from '../../src/vscode/notificationModeService';

describe('normalizeToInternal', () => {
  it.each([
    ['progressToastSuccessToast', 'progressToastSuccessToast'],
    ['progressToastSuccessOff', 'progressToastSuccessOff'],
    ['progressStatusBarSuccessStatusBar', 'progressStatusBarSuccessStatusBar'],
    ['progressStatusBarSuccessOff', 'progressStatusBarSuccessOff'],
    ['progressToast', 'progressToastSuccessOff'],
    ['progressStatusBar', 'progressStatusBarSuccessOff'],
    ['successToast', 'progressToastSuccessToast'],
    ['successStatusBar', 'progressStatusBarSuccessStatusBar'],
    ['successOff', 'progressToastSuccessOff']
  ] as const)('normalizes %s to %s', (raw, expected) => {
    expect(normalizeToInternal(raw)).toBe(expected);
  });
});

const makeInspectConfig = (globalValue: unknown, workspaceValue: unknown, workspaceFolderValue: unknown) =>
  ({
    inspect: () => ({ key: '', globalValue, workspaceValue, workspaceFolderValue }),
    get: jest.fn(),
    has: jest.fn(),
    update: jest.fn()
  }) as unknown as vscode.WorkspaceConfiguration;

const makeGetConfig = (value: unknown) =>
  ({
    get: () => value,
    inspect: () => undefined,
    has: jest.fn(),
    update: jest.fn()
  }) as unknown as vscode.WorkspaceConfiguration;

const makeConfig = (values: {
  cmdGlobal?: unknown;
  cmdWorkspace?: unknown;
  cmdWorkspaceFolder?: unknown;
  extGlobal?: unknown;
  extWorkspace?: unknown;
  extWorkspaceFolder?: unknown;
  globalGet?: unknown;
}) =>
  jest.spyOn(vscode.workspace, 'getConfiguration').mockImplementation((section?: string) => {
    if (section === 'ext.commandLevelNotifications')
      return makeInspectConfig(values.cmdGlobal, values.cmdWorkspace, values.cmdWorkspaceFolder);
    if (section === 'ext') return makeInspectConfig(values.extGlobal, values.extWorkspace, values.extWorkspaceFolder);
    return makeGetConfig(values.globalGet);
  });

describe('getInternalMode', () => {
  const extensionSection = 'ext';
  const commandSection = 'ext.commandLevelNotifications';
  const command = 'My Command';

  afterEach(() => jest.restoreAllMocks());

  it('uses the most specific command setting and normalizes its mode type', () => {
    makeConfig({
      cmdGlobal: 'progressToast',
      cmdWorkspace: 'successStatusBar',
      cmdWorkspaceFolder: 'successOff',
      extGlobal: 'progressStatusBarSuccessStatusBar',
      globalGet: 'progressToastSuccessToast'
    });
    expect(getInternalMode(extensionSection, commandSection, command)).toBe('progressToastSuccessOff');
  });

  it('uses the extension setting before the global setting', () => {
    makeConfig({ extGlobal: 'progressStatusBarSuccessOff', globalGet: 'progressToastSuccessToast' });
    expect(getInternalMode(extensionSection, commandSection, command)).toBe('progressStatusBarSuccessOff');
  });

  it('uses the global setting when more specific values are invalid', () => {
    makeConfig({ cmdGlobal: 'invalid', extGlobal: 'invalid', globalGet: 'progressStatusBarSuccessStatusBar' });
    expect(getInternalMode(extensionSection, commandSection, command)).toBe('progressStatusBarSuccessStatusBar');
  });

  it('defaults to toast progress and success for an invalid global setting', () => {
    makeConfig({ globalGet: 'invalid' });
    expect(getInternalMode(extensionSection, commandSection, command)).toBe('progressToastSuccessToast');
  });
});

describe('NotificationModeService.Default', () => {
  const item = {
    command: undefined as string | undefined,
    name: undefined as string | undefined,
    text: undefined as string | undefined,
    dispose: jest.fn(),
    hide: jest.fn(),
    show: jest.fn()
  };
  const commandDisposable = { dispose: jest.fn() };

  beforeEach(() => {
    (vscode.window.createStatusBarItem as jest.Mock).mockReturnValue(item);
    (vscode.commands.registerCommand as jest.Mock).mockReturnValue(commandDisposable);
  });

  afterEach(() => jest.restoreAllMocks());

  const runWithService = <A>(effect: Effect.Effect<A, never, NotificationModeService>) =>
    Effect.runPromise(effect.pipe(Effect.provide(NotificationModeService.Default('ext', 'status-id', 'Status Name'))));

  it.each([
    ['progressToastSuccessOff', vscode.ProgressLocation.Notification],
    ['progressStatusBarSuccessOff', vscode.ProgressLocation.Window]
  ] as const)('configures the status item and maps %s progress', async (mode, expectedLocation) => {
    makeConfig({ extGlobal: mode });

    await expect(NotificationModeService.getProgressLocation('Command').pipe(runWithService)).resolves.toBe(
      expectedLocation
    );
    expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith('status-id', vscode.StatusBarAlignment.Left, 44);
    expect(item.name).toBe('Status Name');
    expect(item.command).toBe('status-id.showToast');
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith('status-id.showToast', expect.any(Function));
  });

  it('disposes the registered command and status item when the service scope closes', async () => {
    makeConfig({ extGlobal: 'progressToastSuccessOff' });
    await runWithService(NotificationModeService);

    expect(commandDisposable.dispose).toHaveBeenCalledTimes(1);
    expect(item.dispose).toHaveBeenCalledTimes(1);
  });
});
