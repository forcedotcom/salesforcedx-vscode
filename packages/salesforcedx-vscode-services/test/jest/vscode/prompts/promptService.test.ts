/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as vscode from 'vscode';
import { PromptService } from '../../../../src/vscode/prompts/promptService';

const runConfirm = (params: { message: string; confirmLabel: string }) =>
  Effect.runPromiseExit(
    Effect.flatMap(PromptService, svc => svc.confirmOrThrow(params)).pipe(Effect.provide(PromptService.Default))
  );

describe('PromptService.confirmOrThrow', () => {
  let showWarningMessageSpy: jest.SpyInstance;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('resolves when the user clicks the confirm button', async () => {
    showWarningMessageSpy = jest
      .spyOn(vscode.window, 'showWarningMessage')
      .mockResolvedValue('Delete' as unknown as vscode.MessageItem);

    const exit = await runConfirm({ message: 'Delete the org?', confirmLabel: 'Delete' });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(showWarningMessageSpy).toHaveBeenCalledWith('Delete the org?', { modal: true }, 'Delete');
  });

  it('fails with UserCancellationError when the user dismisses the modal', async () => {
    jest.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue(undefined);

    const exit = await runConfirm({ message: 'Delete the org?', confirmLabel: 'Delete' });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('UserCancellationError');
  });
});
