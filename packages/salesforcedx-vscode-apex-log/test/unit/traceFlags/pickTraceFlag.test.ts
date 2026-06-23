/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { TraceFlagItem } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { pickTraceFlag, type TraceFlagQuickPickItem } from '../../../src/traceFlags/traceFlagJsonSync';

const makeFlag = (id: string, overrides: Partial<TraceFlagItem> = {}): TraceFlagItem => ({
  id,
  logType: 'DEVELOPER_LOG',
  expirationDate: new Date(Date.now() + 60_000),
  // isActive is a schema field but isTraceFlagActive checks expirationDate against Date.now(), not this boolean
  isActive: true,
  ...overrides
});

const ACTIVE = makeFlag('tf-active');
const EXPIRED = makeFlag('tf-expired', { expirationDate: new Date(Date.now() - 1000) });

describe('pickTraceFlag', () => {
  it('returns noActive when there are no active flags', async () => {
    const result = await pickTraceFlag([EXPIRED]);
    expect(result).toEqual({ kind: 'noActive' });
    expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
  });

  it('returns noActive when the items array is empty', async () => {
    const result = await pickTraceFlag([]);
    expect(result).toEqual({ kind: 'noActive' });
    expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
  });

  it('calls showQuickPick with active flags and returns picked result', async () => {
    const mockPick: TraceFlagQuickPickItem = { label: ACTIVE.id, traceFlagId: ACTIVE.id };
    jest.mocked(vscode.window.showQuickPick).mockResolvedValue(mockPick as never);

    const result = await pickTraceFlag([ACTIVE, EXPIRED]);

    expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(1);
    const [items] = jest.mocked(vscode.window.showQuickPick).mock.calls[0];
    expect(Array.isArray(items)).toBe(true);
    const typedItems = items as unknown as TraceFlagQuickPickItem[];
    expect(typedItems.map(i => i.traceFlagId)).toEqual([ACTIVE.id]);
    expect(result).toEqual({ kind: 'picked', traceFlagId: ACTIVE.id });
  });

  it('returns cancelled when user cancels the QuickPick', async () => {
    jest.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

    const result = await pickTraceFlag([ACTIVE]);

    expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ kind: 'cancelled' });
  });

  it('uses tracedEntityName as the label when available', async () => {
    const flagWithName = makeFlag('tf-named', { tracedEntityName: 'Alice Smith', tracedEntityId: '005ALICE' });
    jest.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

    await pickTraceFlag([flagWithName]);

    const [items] = jest.mocked(vscode.window.showQuickPick).mock.calls[0];
    const typedItems = items as unknown as TraceFlagQuickPickItem[];
    expect(typedItems[0].label).toBe('Alice Smith');
    expect(typedItems[0].traceFlagId).toBe('tf-named');
  });

  it('falls back to tracedEntityId when tracedEntityName is absent', async () => {
    const flagNoName = makeFlag('tf-noid', { tracedEntityId: '005XYZ' });
    jest.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

    await pickTraceFlag([flagNoName]);

    const [items] = jest.mocked(vscode.window.showQuickPick).mock.calls[0];
    const typedItems = items as unknown as TraceFlagQuickPickItem[];
    expect(typedItems[0].label).toBe('005XYZ');
  });

  it('falls back to tf.id when both tracedEntityName and tracedEntityId are absent', async () => {
    const flagIdOnly = makeFlag('tf-idonly');
    jest.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

    await pickTraceFlag([flagIdOnly]);

    const [items] = jest.mocked(vscode.window.showQuickPick).mock.calls[0];
    const typedItems = items as unknown as TraceFlagQuickPickItem[];
    expect(typedItems[0].label).toBe('tf-idonly');
  });
});
