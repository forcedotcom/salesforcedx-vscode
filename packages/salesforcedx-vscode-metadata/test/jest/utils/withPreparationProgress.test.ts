/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { UserCancellationError } from 'salesforcedx-vscode-services/src/vscode/prompts/promptService';
import type { NonEmptyComponentSet } from 'salesforcedx-vscode-services';
import { withPreparationProgress } from '../../../src/utils/withPreparationProgress';
import { ConflictsDetectedError } from '../../../src/conflict/conflictErrors';

// Minimal branded NonEmptyComponentSet for testing
const makeCS = (size = 1) => ({ size }) as unknown as NonEmptyComponentSet;

const mockUserCancellationError = UserCancellationError;

const createMockServicesApi = () => ({
  services: {
    UserCancellationError: mockUserCancellationError
  }
});

const createMockExtensionProvider = () =>
  ({
    getServicesApi: Effect.succeed(createMockServicesApi())
  }) as unknown as ExtensionProviderService;

const provideServices = (e: Effect.Effect<unknown, unknown, unknown>) =>
  e.pipe(Effect.provideService(ExtensionProviderService, createMockExtensionProvider()));

const runWithServices = <A>(effect: Effect.Effect<A, unknown, ExtensionProviderService>) =>
  Effect.runPromise(effect.pipe(provideServices) as Effect.Effect<A, unknown, never>);

const runWithServicesExit = <A>(effect: Effect.Effect<A, unknown, ExtensionProviderService>) =>
  Effect.runPromiseExit(effect.pipe(provideServices) as Effect.Effect<A, unknown, never>);

/** Make withProgress call the task callback immediately, returning a controllable token */
const setupWithProgress = () => {
  const progress = { report: jest.fn() };
  const cancellationListeners: (() => void)[] = [];
  const token = {
    isCancellationRequested: false,
    onCancellationRequested: jest.fn((listener: () => void) => {
      cancellationListeners.push(listener);
      return { dispose: jest.fn() };
    })
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (vscode.window.withProgress as jest.Mock).mockImplementation((_options: unknown, task: any) => task(progress, token));

  const cancel = () => cancellationListeners.forEach(l => l());
  return { progress, token, cancel };
};

describe('withPreparationProgress', () => {
  describe('initial progress message', () => {
    it('reports "Preparing deployment..." for deploy', async () => {
      const { progress } = setupWithProgress();
      const cs = makeCS();
      await runWithServices(Effect.succeed(cs).pipe(withPreparationProgress('deploy')));
      expect(progress.report).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('deployment') })
      );
    });

    it('reports "Preparing retrieval..." for retrieve', async () => {
      const { progress } = setupWithProgress();
      const cs = makeCS();
      await runWithServices(Effect.succeed(cs).pipe(withPreparationProgress('retrieve')));
      expect(progress.report).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('retrieval') })
      );
    });

    it('reports "Preparing deletion..." for delete', async () => {
      const { progress } = setupWithProgress();
      const cs = makeCS();
      await runWithServices(Effect.succeed(cs).pipe(withPreparationProgress('delete')));
      expect(progress.report).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('deletion') })
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
    const detectConflictsFn = jest.fn(() => Effect.void);

    await runWithServices(Effect.succeed(cs).pipe(withPreparationProgress('deploy', detectConflictsFn)));

    expect(detectConflictsFn).toHaveBeenCalledWith(cs);
  });

  it('updates progress message to checking_for_conflicts before running detectConflictsFn', async () => {
    const { progress } = setupWithProgress();
    const cs = makeCS();
    const calls: string[] = [];

    const detectConflictsFn = jest.fn(() => {
      calls.push('detect');
      return Effect.void;
    });

    jest.mocked(progress.report).mockImplementation(({ message }: { message?: string }) => {
      if (message) calls.push(message);
    });

    await runWithServices(Effect.succeed(cs).pipe(withPreparationProgress('deploy', detectConflictsFn)));

    const detectIdx = calls.indexOf('detect');
    const messageIdx = calls.findIndex(c => c.includes('conflict'));
    expect(messageIdx).toBeGreaterThanOrEqual(0);
    expect(messageIdx).toBeLessThan(detectIdx);
  });

  it('does not call detectConflictsFn when not provided', async () => {
    const { progress } = setupWithProgress();
    const cs = makeCS();
    const result = await runWithServices(Effect.succeed(cs).pipe(withPreparationProgress('deploy')));

    expect(result).toBe(cs);
    expect(progress.report).toHaveBeenCalledTimes(1);
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
    const detectConflictsFn = jest.fn(() => Effect.fail(conflictsError));

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
});
