/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { TraceFlagItem } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { pickTraceFlag } from '../../../src/traceFlags/traceFlagJsonSync';

const makeFlag = (id: string, overrides: Partial<TraceFlagItem> = {}): TraceFlagItem => ({
  id,
  logType: 'DEVELOPER_LOG',
  expirationDate: new Date(Date.now() + 60_000),
  isActive: true,
  ...overrides
});

const ACTIVE = makeFlag('tf-active');
const EXPIRED = makeFlag('tf-expired', { expirationDate: new Date(Date.now() - 1000) });

describe('pickTraceFlag', () => {
  it('returns undefined immediately when there are no active flags', async () => {
    const result = await pickTraceFlag([EXPIRED]);
    expect(result).toBeUndefined();
    expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
  });

  it('returns undefined immediately when the items array is empty', async () => {
    const result = await pickTraceFlag([]);
    expect(result).toBeUndefined();
    expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
  });

  it('calls showQuickPick with active flags and returns the selected item', async () => {
    const mockPick = { label: ACTIVE.id, traceFlagId: ACTIVE.id };
    jest.mocked(vscode.window.showQuickPick).mockResolvedValue(mockPick as never);

    const result = await pickTraceFlag([ACTIVE, EXPIRED]);

    expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(1);
    const [items] = jest.mocked(vscode.window.showQuickPick).mock.calls[0];
    expect(Array.isArray(items)).toBe(true);
    const typedItems = items as unknown as { traceFlagId: string }[];
    expect(typedItems.map(i => i.traceFlagId)).toEqual([ACTIVE.id]);
    expect(result).toBe(mockPick);
  });

  it('returns undefined when user cancels the QuickPick', async () => {
    jest.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

    const result = await pickTraceFlag([ACTIVE]);

    expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(1);
    expect(result).toBeUndefined();
  });

  it('uses tracedEntityName as the label when available', async () => {
    const flagWithName = makeFlag('tf-named', { tracedEntityName: 'Alice Smith', tracedEntityId: '005ALICE' });
    jest.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

    await pickTraceFlag([flagWithName]);

    const [items] = jest.mocked(vscode.window.showQuickPick).mock.calls[0];
    const item = (items as unknown as { label: string; traceFlagId: string }[])[0];
    expect(item.label).toBe('Alice Smith');
    expect(item.traceFlagId).toBe('tf-named');
  });

  it('falls back to tracedEntityId when tracedEntityName is absent', async () => {
    const flagNoName = makeFlag('tf-noid', { tracedEntityId: '005XYZ' });
    jest.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

    await pickTraceFlag([flagNoName]);

    const [items] = jest.mocked(vscode.window.showQuickPick).mock.calls[0];
    const item = (items as unknown as { label: string }[])[0];
    expect(item.label).toBe('005XYZ');
  });
});
