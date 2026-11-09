/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { MockInstance as VitestMockInstance } from 'vitest';
import * as Cause from 'effect/Cause';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import * as Option from 'effect/Option';
import * as vscode from 'vscode';
import { PromptService } from '../../../../src/vscode/prompts/promptService';
import { NotificationModeService } from '../../../../src/vscode/notificationModeService';

const runConfirm = (params: { message: string; confirmLabel: string }) =>
  Effect.runPromiseExit(
    Effect.flatMap(PromptService, svc => svc.confirmOrThrow(params)).pipe(Effect.provide(PromptService.Default))
  );
const testTitle = (value: string) => value;

describe('PromptService.confirmOrThrow', () => {
  let showWarningMessageSpy: VitestMockInstance;

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('resolves when the user clicks the confirm button', async () => {
    showWarningMessageSpy = vi
      .spyOn(vscode.window, 'showWarningMessage')
      // showWarningMessage with string items resolves to `string | undefined`; vi.spyOn infers the
      // MessageItem overload, so cast the spy's resolved value to that overload's type.
      .mockResolvedValue('Delete' as unknown as vscode.MessageItem);

    const exit = await runConfirm({ message: 'Delete the org?', confirmLabel: 'Delete' });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(showWarningMessageSpy).toHaveBeenCalledWith('Delete the org?', { modal: true }, 'Delete');
  });

  it('fails with UserCancellationError when the user dismisses the modal', async () => {
    vi.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue(undefined);

    const exit = await runConfirm({ message: 'Delete the org?', confirmLabel: 'Delete' });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('UserCancellationError');
  });
});

describe('PromptService command-aware progress', () => {
  const command = 'SFDX: Run Tests';
  const title = testTitle('Running tests');
  const report = vi.fn();
  const getProgressLocation = vi.fn<NotificationModeService['getProgressLocation']>();
  let tokenSource: vscode.CancellationTokenSource;
  let progressClosed: Promise<unknown>;

  const run = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.provideService(NotificationModeService, { getProgressLocation } as unknown as NotificationModeService),
      Effect.provide(PromptService.Default)
    );

  beforeEach(() => {
    tokenSource = new vscode.CancellationTokenSource();
    getProgressLocation.mockImplementation(() => Effect.succeed(vscode.ProgressLocation.Notification));
    vi.spyOn(vscode.window, 'withProgress').mockImplementation((_options, task) => {
      progressClosed = Promise.resolve(task({ report }, tokenSource.token));
      return progressClosed;
    });
  });

  afterEach(() => {
    tokenSource.dispose();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it.each([false, true])(
    'resolves command settings lazily and preserves results/errors (cancellable: %s)',
    async cancellable => {
      const promptService = await Effect.runPromise(PromptService.pipe(Effect.provide(PromptService.Default)));
      const withProgress = promptService.withProgress({ command, title, cancellable });
      expect(getProgressLocation).not.toHaveBeenCalled();

      for (const location of [vscode.ProgressLocation.Notification, vscode.ProgressLocation.Window] as const) {
        getProgressLocation.mockImplementation(() => Effect.succeed(location));
        expect(await Effect.runPromise(withProgress(() => Effect.succeed(42)).pipe(run))).toBe(42);
        await progressClosed;
        expect(vscode.window.withProgress).toHaveBeenLastCalledWith(
          { title, location, cancellable },
          expect.any(Function)
        );
      }
      const error = { _tag: 'WorkFailed', message: 'failure' };
      const exit = await Effect.runPromiseExit(withProgress(() => Effect.fail(error)).pipe(run));
      await progressClosed;
      expect(Exit.isFailure(exit) && Cause.failureOption(exit.cause)).toEqual(Option.some(error));
      expect(getProgressLocation).toHaveBeenCalledTimes(3);
      expect(getProgressLocation).toHaveBeenLastCalledWith(command);
    }
  );

  it('supplies the reporter/token and honors an explicit location', async () => {
    getProgressLocation.mockImplementation(() => Effect.succeed(vscode.ProgressLocation.Window));
    const result = await Effect.runPromise(
      Effect.flatMap(PromptService, prompts =>
        prompts.withProgress({ title, location: vscode.ProgressLocation.Window, cancellable: false })(
          (progress, token) =>
            Effect.sync(() => {
              progress.report({ message: 'step', increment: 25 });
              expect(token).toBe(tokenSource.token);
              return 'done';
            })
        )
      ).pipe(run)
    );
    await progressClosed;
    expect(result).toBe('done');
    expect(report).toHaveBeenCalledWith({ message: 'step', increment: 25 });
    expect(getProgressLocation).not.toHaveBeenCalled();
    expect(vscode.window.withProgress).toHaveBeenCalledWith(
      { title, location: vscode.ProgressLocation.Window, cancellable: false },
      expect.any(Function)
    );
  });

  it('interrupts work on Cancel and closes progress after cleanup', async () => {
    const started = await Effect.runPromise(Deferred.make<void>());
    const cleanup = vi.fn();
    const fiber = Effect.flatMap(PromptService, prompts => {
      const work = Deferred.succeed(started, undefined).pipe(
        Effect.andThen(Effect.never),
        Effect.ensuring(Effect.sync(cleanup))
      );
      return prompts.withProgress({ command, title, cancellable: true })(() => work);
    }).pipe(run, Effect.runFork);
    await Effect.runPromise(Deferred.await(started));
    tokenSource.cancel();
    const exit = await Effect.runPromise(Fiber.await(fiber));
    await progressClosed;
    expect(Exit.isFailure(exit) && Cause.failureOption(exit.cause)).toEqual(
      Option.some(expect.objectContaining({ _tag: 'UserCancellationError' }))
    );
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('lets token-handling work finish with its real result after Cancel', async () => {
    const started = await Effect.runPromise(Deferred.make<void>());
    const finish = await Effect.runPromise(Deferred.make<string>());
    const cancelled = vi.fn();
    const fiber = Effect.flatMap(PromptService, prompts =>
      prompts.withProgress({
        title,
        command,
        cancellable: true,
        interruptOnCancel: false
      })((_, token) =>
        Effect.acquireUseRelease(
          Effect.sync(() => token.onCancellationRequested(cancelled)),
          () => Deferred.succeed(started, undefined).pipe(Effect.andThen(Deferred.await(finish))),
          disposable => Effect.sync(() => disposable.dispose())
        )
      )
    ).pipe(run, Effect.runFork);
    await Effect.runPromise(Deferred.await(started));
    tokenSource.cancel();
    expect(cancelled).toHaveBeenCalledOnce();
    expect(await Effect.runPromise(Fiber.poll(fiber))).toEqual(Option.none());
    await Effect.runPromise(Deferred.succeed(finish, 'server outcome'));
    expect(await Effect.runPromise(Fiber.join(fiber))).toBe('server outcome');
    await progressClosed;
  });
});

describe('PromptService.withProgress', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('surfaces progress + token to the wrapped effect and returns its value', async () => {
    const tokenSource = new vscode.CancellationTokenSource();
    // invoke the withProgress callback synchronously with a real progress + the (uncancelled) token
    vi.spyOn(vscode.window, 'withProgress').mockImplementation((_opts: any, cb: any) =>
      cb({ report: vi.fn() }, tokenSource.token)
    );

    const exit = await Effect.runPromiseExit(
      Effect.flatMap(PromptService, svc =>
        svc.withProgress({ title: testTitle('Working'), cancellable: true })((progress, token) =>
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
    vi.spyOn(vscode.window, 'withProgress').mockImplementation((_opts: any, cb: any) => {
      const promise = cb({ report: vi.fn() }, tokenSource.token);
      tokenSource.cancel();
      return promise;
    });

    const exit = await Effect.runPromiseExit(
      Effect.flatMap(PromptService, svc =>
        svc.withProgress({ title: testTitle('Working'), cancellable: true })(() => Effect.never)
      ).pipe(Effect.provide(PromptService.Default))
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('UserCancellationError');
  });
});
