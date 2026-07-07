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
      // showWarningMessage with string items resolves to `string | undefined`; jest.spyOn infers the
      // MessageItem overload, so cast the spy's resolved value to that overload's type.
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

describe('PromptService.withCancellableProgressReporting', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('surfaces progress + token to the wrapped effect and returns its value', async () => {
    const tokenSource = new vscode.CancellationTokenSource();
    // invoke the withProgress callback synchronously with a real progress + the (uncancelled) token
    jest
      .spyOn(vscode.window, 'withProgress')
      .mockImplementation((_opts: any, cb: any) => cb({ report: jest.fn() }, tokenSource.token));

    const exit = await Effect.runPromiseExit(
      Effect.flatMap(PromptService, svc =>
        svc.withCancellableProgressReporting('Working')((progress, token) =>
          Effect.sync(() => {
            progress.report({ increment: 50 });
            return token.isCancellationRequested ? 'cancelled' : 'done';
          })
        )
      ).pipe(Effect.provide(PromptService.Default))
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) expect(exit.value).toBe('done');
  });

  it('interrupts the wrapped effect and fails with UserCancellationError when the token is cancelled', async () => {
    const tokenSource = new vscode.CancellationTokenSource();
    // fire cancel after registering the handler, then resolve the progress promise
    jest.spyOn(vscode.window, 'withProgress').mockImplementation((_opts: any, cb: any) => {
      const promise = cb({ report: jest.fn() }, tokenSource.token);
      tokenSource.cancel();
      return promise;
    });

    const exit = await Effect.runPromiseExit(
      Effect.flatMap(PromptService, svc => svc.withCancellableProgressReporting('Working')(() => Effect.never)).pipe(
        Effect.provide(PromptService.Default)
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('UserCancellationError');
  });
});
