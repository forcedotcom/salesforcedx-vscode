/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type LLMServiceInterface, ServiceProvider, ServiceType } from '@salesforce/vscode-service-provider';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as vscode from 'vscode';
import { LLMCallFailed, LLMConnectionFailed, LLMRateLimited } from '../errors';
import { nls } from '../messages/nls';

const EXTENSION_ID = 'salesforcedx-vscode-apex-oas';

/** The extension that most commonly provides the LLM service. We never require it by id on the success path
 * (the service provider decouples us), but when obtaining the service fails it is useful to look at which
 * version is installed: v4.x carries a known regression and v3 is a viable workaround. */
const GPT_EXTENSION_ID = 'salesforce.salesforcedx-einstein-gpt';

/** The Core model signals an exhausted monthly quota with this phrase; it survives only in the raw
 * cause string (the SDK does not type it), so match on the text. */
const isMonthlyRateLimit = (cause: unknown): boolean => /monthly rate limit/i.test(String(cause));

/** A failure to reach the model endpoint surfaces as ModelApiRequestError / "Connection error" in the raw
 * (untyped) cause string. Match on the text to distinguish it from an ordinary call failure. */
const isConnectionError = (cause: unknown): boolean =>
  /ModelApiRequestError|connection error|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|fetch failed/i.test(String(cause));

/** If the GPT extension is installed at a major version with the known LLM regression (v4.x), return a hint
 * recommending the v3 workaround. Returns '' when not installed, version unreadable, or not an affected major.
 * Advisory only — read from `packageJSON.version` (the installed manifest), never a hard gate. */
const v4RegressionHint = (): string => {
  const version: unknown = vscode.extensions.getExtension(GPT_EXTENSION_ID)?.packageJSON?.version;
  if (typeof version !== 'string') return '';
  return /^4\./.test(version) ? ` ${nls.localize('llm_service_gpt_v4_hint', version)}` : '';
};

/** Map a failed `callLLM` to the most specific tagged error: `LLMRateLimited` for an exhausted quota,
 * `LLMConnectionFailed` for an unreachable endpoint, else a generic `LLMCallFailed`. Distinguishing here
 * (the freshest cause) lets callers surface it instead of retrying or swallowing it. */
const toLLMError = (cause: unknown) => {
  if (isMonthlyRateLimit(cause)) return new LLMRateLimited({ message: nls.localize('llm_monthly_rate_limit') });
  if (isConnectionError(cause))
    return new LLMConnectionFailed({ message: nls.localize('llm_connection_failed'), cause });
  return new LLMCallFailed({ message: `LLM call failed: ${String(cause)}`, cause });
};

/** Readiness-probe backoff for obtaining the LLM service: up to 3 retries, ~200ms apart (≈0.6s worst case).
 * Short by design — this only absorbs a brief provider-registration race at startup. A genuinely absent
 * command (e.g. a provider version that never registers it) should fail fast, not stall the user. */
const LLM_AVAILABILITY_SCHEDULE = Schedule.spaced(Duration.millis(200)).pipe(Schedule.intersect(Schedule.recurs(3)));

export class LLMService extends Effect.Service<LLMService>()('LLMService', {
  accessors: true,
  effect: Effect.gen(function* () {
    const getInterface = Effect.tryPromise({
      try: async (): Promise<LLMServiceInterface> => ServiceProvider.getService(ServiceType.LLMService, EXTENSION_ID),
      catch: cause => new LLMCallFailed({ message: `Failed to obtain LLMService: ${String(cause)}`, cause })
    });

    const callLLM = Effect.fn('ApexOas.Llm.callLLM')(function* (
      prompt: string,
      promptId: string | undefined,
      tokenLimit: number | undefined
    ) {
      const llm = yield* getInterface;
      return yield* Effect.tryPromise({
        try: () => llm.callLLM(prompt, promptId, tokenLimit),
        catch: toLLMError
      });
    });

    /** Probe that the LLM service can be obtained from the service provider, without making a call.
     * Used as a precondition for the REST generation path so an unreachable LLM fails the command up
     * front (with the obtain cause attached) rather than partway through generation.
     *
     * `ServiceProvider.getService` is fail-fast: it checks the registered commands once and throws if the
     * provider's LLM-service command isn't registered yet. Our extension can activate before the provider
     * finishes registering it, so retry the obtain a few times with short backoff to absorb that race. This
     * is only a readiness probe — keep it brief; the real generation call has its own retry. */
    const ensureAvailable = Effect.fn('ApexOas.Llm.ensureAvailable')(function* () {
      yield* getInterface.pipe(
        Effect.retry(LLM_AVAILABILITY_SCHEDULE),
        // Log the raw failure so the actual reason (e.g. "Command ...getLLMServiceInstance cannot be found",
        // a provider error, or "not logged in") reaches the output channel — the user-facing notification only
        // shows the friendly message below, which would otherwise hide why it failed.
        Effect.tapError(error => Effect.logError('Failed to obtain LLM service', error)),
        // The raw failure is internal and unactionable as a notification. Replace it with guidance that tells
        // the user what to do, while keeping the original text as a non-Error `cause` for telemetry. The central
        // error handler walks to the innermost Error's message, so a string cause won't shadow this.
        Effect.mapError(
          error =>
            new LLMCallFailed({
              message: `${nls.localize('llm_service_unavailable')}${v4RegressionHint()}`,
              cause: String(error)
            })
        )
      );
    });

    return { callLLM, ensureAvailable };
  })
}) {}
