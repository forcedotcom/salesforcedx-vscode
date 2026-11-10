/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Mock as VitestMock } from 'vitest';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Deferred from 'effect/Deferred';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { PromptService, UserCancellationError } from 'salesforcedx-vscode-services/src/vscode/prompts/promptService';
import { NotificationModeService } from 'salesforcedx-vscode-services/src/vscode/notificationModeService';
import type { NonEmptyComponentSet } from 'salesforcedx-vscode-services';
import { withPreparationProgress } from '../../../src/utils/withPreparationProgress';
import { ConflictsDetectedError } from '../../../src/conflict/conflictErrors';

// Minimal branded NonEmptyComponentSet for testing
const makeCS = (size = 1) => ({ size }) as unknown as NonEmptyComponentSet;

const mockUserCancellationError = UserCancellationError;

const createMockServicesApi = () => ({
  services: {
    UserCancellationError: mockUserCancellationError,
    PromptService,
    NotificationModeService
  }
});

const createMockExtensionProvider = () =>
  ({
    getServicesApi: Effect.succeed(createMockServicesApi())
  }) as unknown as ExtensionProviderService;

const notificationMode = {
  getProgressLocation: () => Effect.succeed(vscode.ProgressLocation.Notification),
  showSuccessNotification: () => Effect.void
} as unknown as NotificationModeService;

const provideServices = (e: Effect.Effect<unknown, unknown, unknown>) =>
  e.pipe(
    Effect.provide(
      Layer.mergeAll(
        Layer.succeed(ExtensionProviderService, createMockExtensionProvider()),
        PromptService.Default,
        Layer.succeed(NotificationModeService, notificationMode)
      )
    )
  );

const runWithServices = <A>(
  effect: Effect.Effect<A, unknown, PromptService | NotificationModeService | ExtensionProviderService>
) => Effect.runPromise(effect.pipe(provideServices) as Effect.Effect<A, unknown, never>);

const runWithServicesExit = <A>(
  effect: Effect.Effect<A, unknown, PromptService | NotificationModeService | ExtensionProviderService>
) => Effect.runPromiseExit(effect.pipe(provideServices) as Effect.Effect<A, unknown, never>);

/** Make withProgress call the task callback immediately, returning a controllable token */
const setupWithProgress = () => {
  const progress = { report: vi.fn() };
  const cancellationListeners: (() => void)[] = [];
  const token = {
    isCancellationRequested: false,
    onCancellationRequested: vi.fn((listener: () => void) => {
      cancellationListeners.push(listener);
      return { dispose: vi.fn() };
    })
  };

  (vscode.window.withProgress as VitestMock).mockImplementation((_options: unknown, task: any) =>
    task(progress, token)
  );

  const cancel = () => cancellationListeners.forEach(l => l());
  return { progress, token, cancel };
};

describe('withPreparationProgress', () => {
  describe('progress title', () => {
    it('shows "Preparing deployment..." for deploy', async () => {
      setupWithProgress();
      const cs = makeCS();
      await runWithServices(Effect.succeed(cs).pipe(withPreparationProgress('deploy')));
      expect(vscode.window.withProgress).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringContaining('deployment') }),
        expect.any(Function)
      );
    });

    it('shows "Preparing retrieval..." for retrieve', async () => {
      setupWithProgress();
      const cs = makeCS();
      await runWithServices(Effect.succeed(cs).pipe(withPreparationProgress('retrieve')));
      expect(vscode.window.withProgress).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringContaining('retrieval') }),
        expect.any(Function)
      );
    });

    it('shows "Preparing deletion..." for delete', async () => {
      setupWithProgress();
      const cs = makeCS();
      await runWithServices(Effect.succeed(cs).pipe(withPreparationProgress('delete')));
      expect(vscode.window.withProgress).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringContaining('deletion') }),
        expect.any(Function)
      );
    });
  });

  it('returns the ComponentSet from prepare on success', async () => {
    setupWithProgress();
    const cs = makeCS(5);
    const result = await runWithServices(Effect.succeed(cs).pipe(withPreparationProgress('deploy')));
    expect(result).toBe(cs);
  });

  it('runs detectConflictsFn when provided', async () => {
    setupWithProgress();
    const cs = makeCS();
    const detectConflictsFn = vi.fn(() => Effect.void);

    await runWithServices(Effect.succeed(cs).pipe(withPreparationProgress('deploy', detectConflictsFn)));

    expect(detectConflictsFn).toHaveBeenCalledWith(cs);
  });

  it('updates progress message to checking_for_conflicts before running detectConflictsFn', async () => {
    const { progress } = setupWithProgress();
    const cs = makeCS();
    const calls: string[] = [];

    const detectConflictsFn = vi.fn(() => {
      calls.push('detect');
      return Effect.void;
    });

    vi.mocked(progress.report).mockImplementation(({ message }: { message?: string }) => {
      if (message) calls.push(message);
    });

    await runWithServices(Effect.succeed(cs).pipe(withPreparationProgress('deploy', detectConflictsFn)));

    const detectIdx = calls.indexOf('detect');
    const messageIdx = calls.findIndex(c => c.includes('conflict'));
    expect(messageIdx).toBeGreaterThanOrEqual(0);
    expect(messageIdx).toBeLessThan(detectIdx);
  });

  it('does not report a phase update when detectConflictsFn is not provided', async () => {
    const { progress } = setupWithProgress();
    const cs = makeCS();
    const result = await runWithServices(Effect.succeed(cs).pipe(withPreparationProgress('deploy')));

    expect(result).toBe(cs);
    expect(progress.report).not.toHaveBeenCalled();
  });

  it('propagates prepare failures', async () => {
    setupWithProgress();
    const error = new Error('build failed');
    const exit = await runWithServicesExit(Effect.fail(error).pipe(withPreparationProgress('deploy')));

    expect(exit._tag).toBe('Failure');
  });

  it('propagates ConflictsDetectedError from detectConflictsFn', async () => {
    setupWithProgress();
    const cs = makeCS();
    const conflictsError = new ConflictsDetectedError({ pairs: [], componentSet: cs, operationType: 'deploy' });
    const detectConflictsFn = vi.fn(() => Effect.fail(conflictsError));

    const exit = await runWithServicesExit(
      Effect.succeed(cs).pipe(withPreparationProgress('deploy', detectConflictsFn))
    );

    expect(exit._tag).toBe('Failure');
  });

  it('is cancellable — progress notification has cancellable: true', async () => {
    setupWithProgress();
    const cs = makeCS();
    await runWithServices(Effect.succeed(cs).pipe(withPreparationProgress('deploy')));

    expect(vscode.window.withProgress).toHaveBeenCalledWith(
      expect.objectContaining({ cancellable: true }),
      expect.any(Function)
    );
  });

  it('uses ProgressLocation.Notification', async () => {
    setupWithProgress();
    const cs = makeCS();
    await runWithServices(Effect.succeed(cs).pipe(withPreparationProgress('deploy')));

    expect(vscode.window.withProgress).toHaveBeenCalledWith(
      expect.objectContaining({ location: vscode.ProgressLocation.Notification }),
      expect.any(Function)
    );
  });

  it.each(['prepare', 'conflicts'] as const)('interrupts %s and closes progress on Cancel', async phase => {
    const { cancel } = setupWithProgress();
    const started = await Effect.runPromise(Deferred.make<void>());
    const cleanup = vi.fn();
    const pending = Deferred.succeed(started, undefined).pipe(
      Effect.andThen(Effect.never),
      Effect.ensuring(Effect.sync(cleanup))
    );
    const detectConflicts = vi.fn(() => (phase === 'conflicts' ? pending : Effect.void));
    const done = runWithServicesExit(
      (phase === 'prepare' ? pending : Effect.succeed(makeCS())).pipe(
        withPreparationProgress('deploy', detectConflicts)
      )
    );
    await Effect.runPromise(Deferred.await(started));
    cancel();
    const exit = await done;
    expect(exit._tag).toBe('Failure');
    expect(JSON.stringify(exit)).toContain('UserCancellationError');
    expect(cleanup).toHaveBeenCalledOnce();
    expect(detectConflicts).toHaveBeenCalledTimes(phase === 'conflicts' ? 1 : 0);
  });
});
