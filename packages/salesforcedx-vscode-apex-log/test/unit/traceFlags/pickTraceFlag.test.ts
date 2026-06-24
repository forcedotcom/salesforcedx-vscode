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
import type { TraceFlagItem } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { pickTraceFlag, type TraceFlagQuickPickItem } from '../../../src/traceFlags/traceFlagJsonSync';

const makeFlag = (id: string, overrides: Partial<TraceFlagItem> = {}): TraceFlagItem => ({
  id,
  logType: 'DEVELOPER_LOG',
  expirationDate: new Date(Date.now() + 60_000),
  isActive: true,
  ...overrides
});

const ACTIVE = makeFlag('tf-active');

// Mirrors PromptService.considerUndefinedAsCancellation so the pipe under test exercises the real cancellation path.
const considerUndefinedAsCancellation = <T>(value: T | undefined) =>
  value === undefined || (isString(value) && value.trim().length === 0)
    ? Effect.fail({ _tag: 'UserCancellationError', message: 'User cancelled' })
    : Effect.succeed(value);

const run = (active: TraceFlagItem[]) =>
  Effect.runPromiseExit(
    pickTraceFlag(active).pipe(
      Effect.provideService(ExtensionProviderService, {
        getServicesApi: Effect.succeed({
          services: { PromptService: Effect.succeed({ considerUndefinedAsCancellation }) }
        })
      } as unknown as ExtensionProviderService)
    ) as unknown as Effect.Effect<string, { _tag: string }, never>
  );

describe('pickTraceFlag', () => {
  it('calls showQuickPick with the given flags and resolves the picked traceFlagId', async () => {
    const mockPick: TraceFlagQuickPickItem = { label: ACTIVE.id, traceFlagId: ACTIVE.id };
    jest.mocked(vscode.window.showQuickPick).mockResolvedValue(mockPick as never);

    const exit = await run([ACTIVE]);

    expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(1);
    const [items] = jest.mocked(vscode.window.showQuickPick).mock.calls[0];
    const typedItems = items as unknown as TraceFlagQuickPickItem[];
    expect(typedItems.map(i => i.traceFlagId)).toEqual([ACTIVE.id]);
    expect(typedItems[0].description).toBe(ACTIVE.logType);
    expect(typedItems[0].detail).toMatch(/^Expires /);
    expect(exit).toStrictEqual(Exit.succeed(ACTIVE.id));
  });

  it('fails with UserCancellationError when the user dismisses the QuickPick', async () => {
    jest.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

    const exit = await run([ACTIVE]);

    expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(1);
    expect(Exit.isFailure(exit)).toBe(true);
    expect(Exit.isFailure(exit) && exit.cause).toMatchObject({ error: { _tag: 'UserCancellationError' } });
  });

  it.each([
    ['tracedEntityName', { tracedEntityName: 'Alice Smith', tracedEntityId: '005ALICE' }, 'Alice Smith'],
    ['tracedEntityId when name absent', { tracedEntityId: '005XYZ' }, '005XYZ'],
    ['tf.id when name and entityId absent', {}, 'tf-label']
  ])('labels the item with %s', async (_desc, overrides, expectedLabel) => {
    const flag = makeFlag('tf-label', overrides);
    jest.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

    await run([flag]);

    const [items] = jest.mocked(vscode.window.showQuickPick).mock.calls[0];
    const typedItems = items as unknown as TraceFlagQuickPickItem[];
    expect(typedItems[0].label).toBe(expectedLabel);
    expect(typedItems[0].traceFlagId).toBe('tf-label');
  });
});
