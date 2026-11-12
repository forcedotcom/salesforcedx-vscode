/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import {
  UserCancellationError,
  NotificationModeService,
  PromptService,
  type NonEmptyComponentSet
} from '@salesforce/vscode-services/v2';
import { withPreparationProgress } from '../../../src/utils/withPreparationProgress';
import { ConflictsDetectedError } from '../../../src/conflict/conflictErrors';

// Minimal branded NonEmptyComponentSet for testing
const makeCS = (size = 1) => ({ size }) as unknown as NonEmptyComponentSet;

const mockUserCancellationError = UserCancellationError;

const createMockServicesApi = () => ({
  v2: {
    services: {
      UserCancellationError: mockUserCancellationError,
      NotificationModeService,
      PromptService
    }
  }
});

const createMockExtensionProvider = () =>
  ({
    getServicesApi: Effect.succeed(createMockServicesApi())
  }) as unknown as ExtensionProviderService['Service'];

const notificationMode = {
  getProgressLocation: () => Effect.succeed(vscode.ProgressLocation.Notification),
  showSuccessNotification: () => Effect.void
} as unknown as NotificationModeService['Service'];

const progress = { report: vi.fn() };
const token: vscode.CancellationToken = {
  isCancellationRequested: false,
  onCancellationRequested: vi.fn(() => ({ dispose: vi.fn() }))
};
const withCancellableProgressReporting = vi.fn(
  (_title: string, _location?: vscode.ProgressLocation) =>
    <A, E, R>(
      build: (
        progress: vscode.Progress<{ increment?: number; message?: string }>,
        token: vscode.CancellationToken
      ) => Effect.Effect<A, E, R>
    ) =>
      build(progress, token)
);
const promptService = { withCancellableProgressReporting } as unknown as PromptService['Service'];

const provideServices = (e: Effect.Effect<unknown, unknown, unknown>) => e.pipe(Effect.provide(mockServicesLayer));

const mockServicesLayer = Layer.mergeAll(
  Layer.succeed(ExtensionProviderService, createMockExtensionProvider()),
  Layer.succeed(NotificationModeService, notificationMode),
  Layer.succeed(PromptService, promptService)
);

const runWithServices = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.runPromise(effect.pipe(provideServices) as Effect.Effect<A, E, never>);

const runWithServicesExit = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.runPromiseExit(effect.pipe(provideServices) as Effect.Effect<A, E, never>);

/** Run the delegated progress operation with a mock progress reporter. */
const setupWithProgress = () => {
  vi.clearAllMocks();
  withCancellableProgressReporting.mockImplementation((_title, _location) => build => build(progress, token));
  return { progressReporter: progress };
};

describe('withPreparationProgress', () => {
  describe('progress title', () => {
    it('shows "Preparing deployment..." for deploy', async () => {
      setupWithProgress();
      const cs = makeCS();
      await runWithServices(Effect.succeed(cs).pipe(withPreparationProgress('deploy')));
      expect(withCancellableProgressReporting).toHaveBeenCalledWith(
        expect.stringContaining('deployment'),
        vscode.ProgressLocation.Notification
      );
    });

    it('shows "Preparing retrieval..." for retrieve', async () => {
      setupWithProgress();
      const cs = makeCS();
      await runWithServices(Effect.succeed(cs).pipe(withPreparationProgress('retrieve')));
      expect(withCancellableProgressReporting).toHaveBeenCalledWith(
        expect.stringContaining('retrieval'),
        vscode.ProgressLocation.Notification
      );
    });

    it('shows "Preparing deletion..." for delete', async () => {
      setupWithProgress();
      const cs = makeCS();
      await runWithServices(Effect.succeed(cs).pipe(withPreparationProgress('delete')));
      expect(withCancellableProgressReporting).toHaveBeenCalledWith(
        expect.stringContaining('deletion'),
        vscode.ProgressLocation.Notification
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
    const { progressReporter } = setupWithProgress();
    const cs = makeCS();
    const calls: string[] = [];

    const detectConflictsFn = vi.fn(() => {
      calls.push('detect');
      return Effect.void;
    });

    vi.mocked(progressReporter.report).mockImplementation(({ message }: { message?: string }) => {
      if (message) calls.push(message);
    });

    await runWithServices(Effect.succeed(cs).pipe(withPreparationProgress('deploy', detectConflictsFn)));

    const detectIdx = calls.indexOf('detect');
    const messageIdx = calls.findIndex(c => c.includes('conflict'));
    expect(messageIdx).toBeGreaterThanOrEqual(0);
    expect(messageIdx).toBeLessThan(detectIdx);
  });

  it('does not report a phase update when detectConflictsFn is not provided', async () => {
    const { progressReporter } = setupWithProgress();
    const cs = makeCS();
    const result = await runWithServices(Effect.succeed(cs).pipe(withPreparationProgress('deploy')));

    expect(result).toBe(cs);
    expect(progressReporter.report).not.toHaveBeenCalled();
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

  it('propagates cancellation failures from PromptService', async () => {
    setupWithProgress();
    const error = new UserCancellationError({ message: 'User cancelled' });
    withCancellableProgressReporting.mockImplementationOnce(() => () => Effect.fail(error) as never);

    const exit = await runWithServicesExit(Effect.succeed(makeCS()).pipe(withPreparationProgress('deploy')));

    expect(exit._tag).toBe('Failure');
    expect(JSON.stringify(exit)).toContain('UserCancellationError');
  });
});
