/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { getInternalMode, normalizeToInternal } from '../../src/notificationMode';

// ─── normalizeToInternal ──────────────────────────────────────────────────────

describe('normalizeToInternal', () => {
  it.each([
    ['progressToastSuccessToast', 'progressToastSuccessToast'],
    ['progressToastSuccessOff', 'progressToastSuccessOff'],
    ['progressStatusBarSuccessStatusBar', 'progressStatusBarSuccessStatusBar'],
    ['progressStatusBarSuccessOff', 'progressStatusBarSuccessOff']
  ] as const)('passes ProgressAndSuccessMode %s through unchanged', (raw, expected) => {
    expect(normalizeToInternal(raw)).toBe(expected);
  });

  it.each([
    ['progressToast', 'progressToastSuccessOff'],
    ['progressStatusBar', 'progressStatusBarSuccessOff']
  ] as const)('maps ProgressOnlyMode %s to %s (suppressed success)', (raw, expected) => {
    expect(normalizeToInternal(raw)).toBe(expected);
  });

  it.each([
    ['successToast', 'progressToastSuccessToast'],
    ['successStatusBar', 'progressStatusBarSuccessStatusBar'],
    ['successOff', 'progressToastSuccessOff']
  ] as const)('maps SuccessOnlyMode %s to %s (default progress side)', (raw, expected) => {
    expect(normalizeToInternal(raw)).toBe(expected);
  });
});

// ─── getInternalMode ──────────────────────────────────────────────────────────

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
  const EXT = 'ext';
  const CMD_SECTION = 'ext.commandLevelNotifications';
  const CMD = 'My Command';

  afterEach(() => jest.restoreAllMocks());

  describe('command-level wins over extension-level and global', () => {
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
    ] as const)('command global %s → %s', (raw, expected) => {
      makeConfig({
        cmdGlobal: raw,
        extGlobal: 'progressStatusBarSuccessOff',
        globalGet: 'progressStatusBarSuccessStatusBar'
      });
      expect(getInternalMode(EXT, CMD_SECTION, CMD)).toBe(expected);
    });

    it('command workspaceFolder overrides command workspace and command global', () => {
      makeConfig({
        cmdGlobal: 'progressToastSuccessOff',
        cmdWorkspace: 'progressStatusBarSuccessOff',
        cmdWorkspaceFolder: 'progressToastSuccessToast'
      });
      expect(getInternalMode(EXT, CMD_SECTION, CMD)).toBe('progressToastSuccessToast');
    });

    it('command workspace overrides command global', () => {
      makeConfig({ cmdGlobal: 'progressToastSuccessOff', cmdWorkspace: 'progressStatusBarSuccessStatusBar' });
      expect(getInternalMode(EXT, CMD_SECTION, CMD)).toBe('progressStatusBarSuccessStatusBar');
    });
  });

  describe('extension-level wins over global when no command-level setting', () => {
    it.each([
      ['progressToastSuccessToast'],
      ['progressToastSuccessOff'],
      ['progressStatusBarSuccessStatusBar'],
      ['progressStatusBarSuccessOff']
    ] as const)('extension global %s passes through', raw => {
      makeConfig({ extGlobal: raw, globalGet: 'progressStatusBarSuccessOff' });
      expect(getInternalMode(EXT, CMD_SECTION, CMD)).toBe(raw);
    });

    it('extension workspaceFolder overrides extension workspace and extension global', () => {
      makeConfig({
        extGlobal: 'progressToastSuccessOff',
        extWorkspace: 'progressStatusBarSuccessOff',
        extWorkspaceFolder: 'progressToastSuccessToast'
      });
      expect(getInternalMode(EXT, CMD_SECTION, CMD)).toBe('progressToastSuccessToast');
    });
  });

  describe('global fallback', () => {
    it('uses global setting when no command-level or extension-level is set', () => {
      makeConfig({ globalGet: 'progressStatusBarSuccessStatusBar' });
      expect(getInternalMode(EXT, CMD_SECTION, CMD)).toBe('progressStatusBarSuccessStatusBar');
    });

    it('defaults to progressToastSuccessToast when global setting is absent or invalid', () => {
      makeConfig({ globalGet: undefined });
      expect(getInternalMode(EXT, CMD_SECTION, CMD)).toBe('progressToastSuccessToast');
    });

    it('defaults to progressToastSuccessToast when global setting is an unknown string', () => {
      makeConfig({ globalGet: 'notARealMode' });
      expect(getInternalMode(EXT, CMD_SECTION, CMD)).toBe('progressToastSuccessToast');
    });
  });

  describe('invalid values are ignored', () => {
    it('ignores invalid command-level value and falls through to extension-level', () => {
      makeConfig({ cmdGlobal: 'bogus', extGlobal: 'progressStatusBarSuccessOff' });
      expect(getInternalMode(EXT, CMD_SECTION, CMD)).toBe('progressStatusBarSuccessOff');
    });

    it('ignores invalid extension-level value and falls through to global', () => {
      makeConfig({ extGlobal: 'bogus', globalGet: 'progressToastSuccessOff' });
      expect(getInternalMode(EXT, CMD_SECTION, CMD)).toBe('progressToastSuccessOff');
    });
  });
});
