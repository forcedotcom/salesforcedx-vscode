/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Mock as VitestMock } from 'vitest';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import { PromptService, UserCancellationError } from 'salesforcedx-vscode-services/src/vscode/prompts/promptService';
import * as vscode from 'vscode';
import { type ApexTestQuickPickItem } from '../../../src/utils/fileHelpers';
import { selectApexClasses } from '../../../src/utils/selectApexClasses';

describe('selectApexClasses', () => {
  const selectedClasses: ApexTestQuickPickItem[] = [
    { label: 'LocalTest', type: 'Class' },
    { label: 'ManagedTest', type: 'Class', fullClassName: 'ns.ManagedTest' }
  ];
  const servicesLayer = Layer.mergeAll(
    PromptService.Default,
    Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed({
        services: { PromptService }
      })
    } as unknown as ExtensionProviderService)
  );
  const runSelection = () =>
    selectApexClasses(selectedClasses).pipe(Effect.provide(servicesLayer), Effect.runPromiseExit);

  afterEach(() => vi.clearAllMocks());

  it.each([
    { result: undefined, description: 'dismissed' },
    { result: [], description: 'empty' }
  ])('cancels when the class selection is $description', async ({ result }) => {
    (vscode.window.showQuickPick as VitestMock).mockResolvedValue(result);

    expect(await runSelection()).toStrictEqual(Exit.fail(new UserCancellationError()));
  });

  it('returns selected class names, preferring the fully-qualified name when available', async () => {
    (vscode.window.showQuickPick as VitestMock).mockResolvedValue(selectedClasses);

    expect(await runSelection()).toStrictEqual(Exit.succeed(['LocalTest', 'ns.ManagedTest']));
    expect(vscode.window.showQuickPick).toHaveBeenCalledExactlyOnceWith(selectedClasses, { canPickMany: true });
  });
});
