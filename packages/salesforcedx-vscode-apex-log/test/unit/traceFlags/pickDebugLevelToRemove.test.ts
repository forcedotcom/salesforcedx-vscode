/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DebugLevelItem } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { pickDebugLevelToRemove, type PickDebugLevelToRemoveResult } from '../../../src/traceFlags/traceFlagJsonSync';

const makeLevel = (id: string, overrides: Partial<DebugLevelItem> = {}): DebugLevelItem => ({
  id,
  masterLabel: `Label ${id}`,
  developerName: `Dev_${id}`,
  language: null,
  apexCode: 'DEBUG',
  apexProfiling: 'NONE',
  callout: 'NONE',
  database: 'INFO',
  nba: 'NONE',
  system: 'DEBUG',
  validation: 'NONE',
  visualforce: 'INFO',
  wave: 'NONE',
  workflow: 'NONE',
  ...overrides
});

const LEVEL_A = makeLevel('dl-a', { masterLabel: 'My Level', developerName: 'My_Level' });
const LEVEL_B = makeLevel('dl-b', { masterLabel: 'Other Level', developerName: 'Other_Level' });

describe('pickDebugLevelToRemove', () => {
  it('returns noLevels when the items array is empty', async () => {
    const result = await pickDebugLevelToRemove([]);
    expect(result).toEqual({ kind: 'noLevels' });
    expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
  });

  it('calls showQuickPick with all levels and returns picked result', async () => {
    const mockPick = { label: LEVEL_A.masterLabel, debugLevelId: LEVEL_A.id };
    jest.mocked(vscode.window.showQuickPick).mockResolvedValue(mockPick as never);

    const result = await pickDebugLevelToRemove([LEVEL_A, LEVEL_B]);

    expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(1);
    const [items] = jest.mocked(vscode.window.showQuickPick).mock.calls[0];
    expect(Array.isArray(items)).toBe(true);
    const typedItems = items as unknown as Array<{ debugLevelId: string; label: string }>;
    expect(typedItems.map(i => i.debugLevelId)).toEqual([LEVEL_A.id, LEVEL_B.id]);
    expect(result).toEqual({ kind: 'picked', debugLevelId: LEVEL_A.id });
  });

  it('returns cancelled when user cancels the QuickPick', async () => {
    jest.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

    const result: PickDebugLevelToRemoveResult = await pickDebugLevelToRemove([LEVEL_A]);

    expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ kind: 'cancelled' });
  });

  it('uses masterLabel as the QuickPick label', async () => {
    jest.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

    await pickDebugLevelToRemove([LEVEL_A]);

    const [items] = jest.mocked(vscode.window.showQuickPick).mock.calls[0];
    const typedItems = items as unknown as Array<{ label: string; detail: string }>;
    expect(typedItems[0].label).toBe('My Level');
    expect(typedItems[0].detail).toBe('My_Level');
  });
});
