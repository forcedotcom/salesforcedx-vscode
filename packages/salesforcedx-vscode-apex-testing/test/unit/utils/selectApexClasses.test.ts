/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Mock as VitestMock } from 'vitest';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Arr from 'effect/Array';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import { isNotUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import { PromptService, UserCancellationError } from '@salesforce/vscode-services/v2';
import * as vscode from 'vscode';
import { type ApexTestQuickPickItem } from '../../../src/utils/fileHelpers';
import { selectApexClasses } from '../../../src/utils/selectApexClasses';

describe('selectApexClasses', () => {
  const selectedClasses: ApexTestQuickPickItem[] = [
    { label: 'LocalTest', type: 'Class' },
    { label: 'ManagedTest', type: 'Class', fullClassName: 'ns.ManagedTest' }
  ];
  const promptService = {
    considerEmptySelectionAsCancellation: <T>(selection: readonly T[] | undefined) =>
      Effect.succeed(selection).pipe(
        Effect.filterOrFail(
          (value): value is Arr.NonEmptyReadonlyArray<T> => isNotUndefined(value) && Arr.isReadonlyArrayNonEmpty(value),
          () => new UserCancellationError({ message: 'User cancelled' })
        )
      )
  } as unknown as PromptService['Service'];
  const servicesLayer = Layer.mergeAll(
    Layer.succeed(PromptService, promptService),
    Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed({
        v2: { services: { PromptService } }
      })
    } as unknown as ExtensionProviderService['Service'])
  );
  const runSelection = () =>
    selectApexClasses(selectedClasses).pipe(Effect.provide(servicesLayer), Effect.runPromiseExit);
  const expectCancellation = async () => {
    const exit = await runSelection();
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(
        exit.cause.reasons.some(reason => reason._tag === 'Fail' && Schema.is(UserCancellationError)(reason.error))
      ).toBe(true);
    }
  };

  afterEach(() => vi.clearAllMocks());

  it.each([
    { result: undefined, description: 'dismissed' },
    { result: [], description: 'empty' }
  ])('cancels when the class selection is $description', async ({ result }) => {
    (vscode.window.showQuickPick as VitestMock).mockResolvedValue(result);

    await expectCancellation();
  });

  it('returns selected class names, preferring the fully-qualified name when available', async () => {
    (vscode.window.showQuickPick as VitestMock).mockResolvedValue(selectedClasses);

    expect(await runSelection()).toStrictEqual(Exit.succeed(['LocalTest', 'ns.ManagedTest']));
    expect(vscode.window.showQuickPick).toHaveBeenCalledExactlyOnceWith(selectedClasses, { canPickMany: true });
  });
});
