/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Option from 'effect/Option';
import * as vscode from 'vscode';
import type { LLMCallFailed } from '../../../src/errors';
import { LLMService } from '../../../src/services/llmService';

/** Mock the service provider so we control whether/when an LLM service can be obtained. The `getService`
 * mock is created up front and referenced directly (never extracted off the namespace) to keep ESLint's
 * unbound-method rule satisfied. */
const mockGetService = jest.fn();
jest.mock('@salesforce/vscode-service-provider', () => ({
  ServiceProvider: { getService: (...args: unknown[]) => mockGetService(...args) },
  ServiceType: { LLMService: 'LLMService' }
}));

/** Handle to the shared vscode mock's getExtension (used by the v4-regression hint). */
const mockGetExtension = vscode.extensions.getExtension as unknown as jest.Mock;
/** Make getExtension report the GPT extension installed at the given version (or absent when undefined). */
const setGptExtensionVersion = (version: string | undefined): void => {
  mockGetExtension.mockReturnValue(version === undefined ? undefined : { packageJSON: { version } });
};

/** Run `ensureAvailable` with the real LLMService layer provided. */
const runEnsureAvailable = () =>
  Effect.runPromiseExit(LLMService.ensureAvailable().pipe(Effect.provide(LLMService.Default)));

describe('LLMService.ensureAvailable', () => {
  beforeEach(() => {
    mockGetService.mockReset();
    mockGetExtension.mockReset();
    setGptExtensionVersion(undefined); // default: GPT extension not installed → no version hint
  });

  it('succeeds when the service is obtainable on the first try', async () => {
    mockGetService.mockResolvedValue({ callLLM: jest.fn() });
    const exit = await runEnsureAvailable();
    expect(Exit.isSuccess(exit)).toBe(true);
    expect(mockGetService).toHaveBeenCalledTimes(1);
  });

  it('retries the obtain and succeeds once the provider registers the service', async () => {
    // Fail-fast on the first attempt (command not registered yet), then succeed — mirrors the activation race.
    mockGetService
      .mockRejectedValueOnce(new Error('Command llmservice cannot be found in the current vscode session.'))
      .mockResolvedValue({ callLLM: jest.fn() });
    const exit = await runEnsureAvailable();
    expect(Exit.isSuccess(exit)).toBe(true);
    expect(mockGetService.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('fails with a user-actionable LLMCallFailed when the service never appears, raw detail kept as cause', async () => {
    mockGetService.mockRejectedValue(
      new Error(
        'Command salesforcedx-einstein-gpt.getLLMServiceInstance cannot be found in the current vscode session.'
      )
    );
    const exit = await runEnsureAvailable();
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Exit.causeOption(exit).pipe(Option.flatMap(Cause.failureOption));
      expect(Option.isSome(failure)).toBe(true);
      if (Option.isSome(failure)) {
        const error = failure.value as LLMCallFailed;
        expect(error._tag).toBe('LLMCallFailed');
        // User-facing message guides them, does not leak the internal command name.
        expect(error.message).toContain('AI model service');
        expect(error.message).not.toContain('getLLMServiceInstance');
        // Raw detail is preserved on the cause (string, so it won't shadow the friendly message downstream).
        expect(String(error.cause)).toContain('getLLMServiceInstance');
      }
    }
  });

  it('appends the v3 workaround hint when the GPT extension is installed at v4.x', async () => {
    setGptExtensionVersion('4.1.0');
    mockGetService.mockRejectedValue(new Error('Command not found'));
    const exit = await runEnsureAvailable();
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Exit.causeOption(exit).pipe(Option.flatMap(Cause.failureOption));
      if (Option.isSome(failure)) {
        const error = failure.value as LLMCallFailed;
        expect(error.message).toContain('4.1.0');
        expect(error.message).toMatch(/3\.x/);
      }
    }
  });

  it('omits the v4 hint when the GPT extension is a different major (or absent)', async () => {
    setGptExtensionVersion('3.9.2');
    mockGetService.mockRejectedValue(new Error('Command not found'));
    const exit = await runEnsureAvailable();
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Exit.causeOption(exit).pipe(Option.flatMap(Cause.failureOption));
      if (Option.isSome(failure)) {
        const error = failure.value as LLMCallFailed;
        expect(error.message).not.toMatch(/3\.x/);
        expect(error.message).not.toContain('3.9.2');
      }
    }
  });
});

describe('LLMService.callLLM error classification', () => {
  beforeEach(() => {
    mockGetService.mockReset();
    mockGetExtension.mockReset();
    setGptExtensionVersion(undefined);
  });

  /** Drive the real callLLM through a controllable service-instance callLLM that rejects with `cause`. */
  const runCallLLMRejecting = (cause: Error) => {
    mockGetService.mockResolvedValue({ callLLM: jest.fn().mockRejectedValue(cause) });
    return Effect.runPromiseExit(LLMService.callLLM('prompt', undefined, 750).pipe(Effect.provide(LLMService.Default)));
  };

  it('maps a ModelApiRequestError connection failure to LLMConnectionFailed with guidance', async () => {
    const exit = await runCallLLMRejecting(new Error('ModelApiRequestError: Connection error.'));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Exit.causeOption(exit).pipe(Option.flatMap(Cause.failureOption));
      if (Option.isSome(failure)) {
        const error = failure.value as { _tag: string; message: string };
        expect(error._tag).toBe('LLMConnectionFailed');
        expect(error.message).toMatch(/connect/i);
        expect(error.message).not.toContain('ModelApiRequestError');
      }
    }
  });

  it('maps an ordinary failure to LLMCallFailed', async () => {
    const exit = await runCallLLMRejecting(new Error('something else went wrong'));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Exit.causeOption(exit).pipe(Option.flatMap(Cause.failureOption));
      if (Option.isSome(failure)) {
        const error = failure.value as { _tag: string };
        expect(error._tag).toBe('LLMCallFailed');
      }
    }
  });
});
