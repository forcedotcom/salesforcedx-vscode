/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import { isString } from 'effect/Predicate';
import type { DebugLevelItem } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { pickDebugLevelToRemove } from '../../../src/traceFlags/traceFlagJsonSync';

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

const considerUndefinedAsCancellation = <T>(value: T | undefined) =>
  value === undefined || (isString(value) && value.trim().length === 0)
    ? Effect.fail({ _tag: 'UserCancellationError', message: 'User cancelled' })
    : Effect.succeed(value);

const run = (items: DebugLevelItem[]) =>
  Effect.runPromiseExit(
    pickDebugLevelToRemove(items).pipe(
      Effect.provideService(ExtensionProviderService, {
        getServicesApi: Effect.succeed({
          services: { PromptService: Effect.succeed({ considerUndefinedAsCancellation }) }
        })
      } as unknown as ExtensionProviderService)
    ) as unknown as Effect.Effect<string, { _tag: string }, never>
  );

describe('pickDebugLevelToRemove', () => {
  it('calls showQuickPick with all levels and resolves the picked debugLevelId', async () => {
    const mockPick = { label: LEVEL_A.masterLabel, debugLevelId: LEVEL_A.id };
    jest.mocked(vscode.window.showQuickPick).mockResolvedValue(mockPick as never);

    const exit = await run([LEVEL_A, LEVEL_B]);

    expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(1);
    const [items] = jest.mocked(vscode.window.showQuickPick).mock.calls[0];
    const typedItems = items as unknown as Array<{ debugLevelId: string; label: string; description: string }>;
    expect(typedItems.map(i => i.debugLevelId)).toEqual([LEVEL_A.id, LEVEL_B.id]);
    expect(typedItems[0].description).toBe('Apex=DEBUG Vf=INFO DB=INFO');
    expect(exit).toStrictEqual(Exit.succeed(LEVEL_A.id));
  });

  it('fails with UserCancellationError when the user dismisses the QuickPick', async () => {
    jest.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

    const exit = await run([LEVEL_A]);

    expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(1);
    expect(Exit.isFailure(exit)).toBe(true);
    expect(Exit.isFailure(exit) && exit.cause).toMatchObject({ error: { _tag: 'UserCancellationError' } });
  });

  it('uses masterLabel as the QuickPick label and developerName as the detail', async () => {
    const level = makeLevel('dl-test', { masterLabel: 'My Level', developerName: 'My_Level' });
    jest.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

    await run([level]);

    const [items] = jest.mocked(vscode.window.showQuickPick).mock.calls[0];
    const typedItems = items as unknown as Array<{ label: string; detail: string }>;
    expect(typedItems[0].label).toBe('My Level');
    expect(typedItems[0].detail).toBe('My_Level');
  });
});
