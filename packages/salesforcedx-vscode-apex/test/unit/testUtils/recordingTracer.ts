/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, getServicesApi } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Tracer from 'effect/Tracer';
import { FsService, PromptService, SettingsService, WorkspaceService } from '@salesforce/vscode-services/v2';

export type RecordedSpan = { name: string; attributes: Map<string, unknown>; ended: boolean };

/**
 * Shared recording-tracer mock for `vi.mock('.../services/runtime')`. Pushes every started span
 * (name + attrs + ended flag) into the array returned by `getRecordedSpans` so span emission/rotation
 * can be asserted. `getRecordedSpans` is a thunk (not the array itself) because Vitest hoists imports
 * above the test's `const mockRecordedSpans`, so the array must be dereferenced lazily. Pass
 * `forkSync: true` when the test asserts synchronously right after the code under test forks (fireSpan
 * via runFork) — it runs the fork on the calling stack so the span is recorded before the assertion.
 */
export const createRecordingRuntimeMock = (
  getRecordedSpans: () => RecordedSpan[],
  options?: {
    forkSync?: boolean;
    provideExtensionProvider?: boolean;
    settingsGetValue?: (section: string, key: string, defaultValue?: unknown) => Effect.Effect<unknown>;
    promptService?: PromptService['Service'];
    fsService?: FsService['Service'];
    workspaceService?: WorkspaceService['Service'];
  }
) => {
  const recordingTracer = Tracer.make({
    span: spanOptions => {
      const recordedSpans = getRecordedSpans();
      const span = new Tracer.NativeSpan(spanOptions);
      const recorded: RecordedSpan = { name: span.name, attributes: span.attributes, ended: false };
      recordedSpans.push(recorded);
      const end = span.end.bind(span);
      span.end = (endTime, exit) => {
        recorded.ended = true;
        end(endTime, exit);
      };
      return span;
    }
  });
  const layer = Layer.succeed(Tracer.Tracer, recordingTracer);
  const provideRuntimeServices = <A, E, R>(effect: Effect.Effect<A, E, R>) => {
    const withExtensionProvider = options?.provideExtensionProvider
      ? effect.pipe(Effect.provideService(ExtensionProviderService, { getServicesApi }))
      : effect;
    const withSettings = options?.settingsGetValue
      ? withExtensionProvider.pipe(
          Effect.provideService(
            SettingsService,
            SettingsService.of({
              getValue: options.settingsGetValue,
              getValueOrElse: options.settingsGetValue
            } as never)
          )
        )
      : withExtensionProvider;
    const withPrompt = options?.promptService
      ? withSettings.pipe(Effect.provideService(PromptService, options.promptService))
      : withSettings;
    const withFs = options?.fsService
      ? withPrompt.pipe(Effect.provideService(FsService, options.fsService))
      : withPrompt;
    return options?.workspaceService
      ? withFs.pipe(Effect.provideService(WorkspaceService, options.workspaceService))
      : withFs;
  };
  return {
    getRuntime: () => ({
      runPromise: (eff: Effect.Effect<unknown, unknown>) =>
        provideRuntimeServices(eff).pipe(Effect.provide(layer), Effect.runPromise),
      runFork: (eff: Effect.Effect<unknown, unknown>) => {
        const provided = provideRuntimeServices(eff).pipe(
          Effect.provide(layer),
          Effect.catchCause(() => Effect.void)
        );
        if (options?.forkSync) {
          Effect.runSync(provided as Effect.Effect<void>);
        } else {
          Effect.runFork(provided);
        }
        return undefined;
      },
      runSync: (eff: Effect.Effect<unknown, unknown>) =>
        provideRuntimeServices(eff).pipe(Effect.provide(layer), Effect.runSync)
    })
  };
};
