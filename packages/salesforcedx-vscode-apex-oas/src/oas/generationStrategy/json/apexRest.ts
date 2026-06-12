/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { PromptGenerationResult } from '../../schemas';
import { annotateRootSpan, ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Chunk from 'effect/Chunk';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { identity } from 'effect/Function';
import * as Option from 'effect/Option';
import * as Schedule from 'effect/Schedule';
import * as Stream from 'effect/Stream';
import type {
  ApexClassOASEligibleResponse,
  ApexClassOASGatherContextResponse,
  ApexOASMethodDetail
} from 'salesforcedx-vscode-apex';
import * as vscode from 'vscode';
import type { DocumentSymbol } from 'vscode-languageserver-protocol';
import { APEX_OAS_OUTPUT_TOKEN_LIMIT } from '../../../constants';
import { InvalidJsonDocument, LLMEmptyResponse, LLMRetriesExhausted, OasGenerationFailed } from '../../../errors';
import { nls } from '../../../messages/nls';
import {
  AA_CLASS_REST_ANNOTATIONS,
  cleanupGeneratedDoc,
  hasValidRestAnnotations,
  parseOASDocFromJson
} from '../../../oasUtils';
import { LLMService } from '../../../services/llmService';
import { buildClassPrompt, generatePromptForMethod } from '../buildPromptUtils';
import { IMPOSED_FACTOR, PROMPT_TOKEN_MAX_LIMIT, SUM_TOKEN_MAX_LIMIT } from '../constants';
import {
  combineYamlByMethod,
  excludeNon2xxResponses,
  excludeUnrelatedMethods,
  extractParametersInPath,
  formatUrlPath,
  updateOperationIds
} from '../formatUtils';

type GenState = {
  readonly servicePrompts: Map<string, string>;
  readonly methodsDocSymbolMap: Map<string, DocumentSymbol>;
  readonly methodsContextMap: Map<string, ApexOASMethodDetail>;
  readonly biddedCallCount: number;
  readonly maxBudget: number;
};

const keepOrLog =
  (label: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.map(Option.some),
      Effect.catchAll(e => Effect.logDebug(`${label} failed with error ${String(e)}`).pipe(Effect.as(Option.none<A>())))
    );

const buildGenState = Effect.fn('ApexOas.ApexRest.buildGenState')(function* (
  metadata: ApexClassOASEligibleResponse,
  context: ApexClassOASGatherContextResponse,
  classPrompt: string,
  sourceText: string
) {
  const methodsDocSymbolMap = new Map<string, DocumentSymbol>();
  const methodsContextMap = new Map<string, ApexOASMethodDetail>();
  (metadata.symbols ?? [])
    .filter(s => s.isApexOasEligible)
    .forEach(symbol => {
      methodsDocSymbolMap.set(symbol.docSymbol.name, symbol.docSymbol);
      const methodDetail = context.methods.find(m => m.name === symbol.docSymbol.name);
      if (methodDetail) {
        methodsContextMap.set(symbol.docSymbol.name, methodDetail);
      }
    });

  const inputs = yield* Effect.forEach(
    (metadata.symbols ?? []).filter(s => s.isApexOasEligible),
    symbol =>
      Effect.gen(function* () {
        const methodName = symbol.docSymbol.name;
        const input = yield* generatePromptForMethod(
          methodName,
          sourceText,
          methodsDocSymbolMap,
          methodsContextMap,
          classPrompt
        );
        return { methodName, input, tokenCount: Math.floor(input.length / 4) };
      }),
    { concurrency: 'unbounded' }
  );
  return inputs.reduce<GenState>(
    (acc, { methodName, input, tokenCount }) => {
      if (acc.biddedCallCount === 0 && acc.maxBudget === 0) return acc;
      if (tokenCount > PROMPT_TOKEN_MAX_LIMIT * IMPOSED_FACTOR) {
        return { ...acc, servicePrompts: new Map(), biddedCallCount: 0, maxBudget: 0 };
      }
      const currentBudget = Math.floor((PROMPT_TOKEN_MAX_LIMIT - tokenCount) * IMPOSED_FACTOR);
      const next = new Map(acc.servicePrompts);
      next.set(methodName, input);
      return {
        ...acc,
        servicePrompts: next,
        biddedCallCount: acc.biddedCallCount + 1,
        maxBudget: Math.min(acc.maxBudget, currentBudget)
      };
    },
    {
      servicePrompts: new Map(),
      methodsDocSymbolMap,
      methodsContextMap,
      biddedCallCount: 0,
      maxBudget: SUM_TOKEN_MAX_LIMIT * IMPOSED_FACTOR
    }
  );
});

const prevalidateLLMResponse = Effect.fn('ApexOas.ApexRest.prevalidateLLMResponse')(function* (
  responses: ReadonlyMap<string, string>,
  methodsContextMap: Map<string, ApexOASMethodDetail>,
  urlMapping: string
) {
  const chunk = yield* Stream.fromIterable(responses.entries()).pipe(
    Stream.filterEffect(([methodName, response]) =>
      response === ''
        ? Effect.logDebug(`LLM response for ${methodName} is empty.`).pipe(Effect.as(false))
        : Effect.succeed(true)
    ),
    Stream.mapEffect(([methodName, response]) =>
      cleanupGeneratedDoc(response).pipe(
        Effect.tap(cleaned => Effect.logDebug({ event: 'cleanedResponse', cleaned })),
        Effect.map(cleaned => [methodName, cleaned] as const),
        keepOrLog('Cleanup')
      )
    ),
    Stream.filterMap(identity),
    Stream.mapEffect(([methodName, cleaned]) =>
      Effect.try({
        try: () => parseOASDocFromJson(cleaned),
        catch: e => new InvalidJsonDocument({ message: `JSON parse failed: ${String(e)}` })
      }).pipe(
        Effect.map(parsed => [methodName, parsed] as const),
        keepOrLog('JSON parse')
      )
    ),
    Stream.filterMap(identity),
    Stream.mapEffect(([methodName, parsed]) =>
      Effect.gen(function* () {
        yield* excludeUnrelatedMethods(parsed, methodName, methodsContextMap);
        excludeNon2xxResponses(parsed);
        const parametersInPath = extractParametersInPath(parsed);
        if (parsed.paths) {
          Object.entries(parsed.paths).forEach(([p, methods]) => {
            const validatedPath = formatUrlPath(parametersInPath, urlMapping);
            delete parsed.paths[p];
            parsed.paths[validatedPath] = methods;
          });
          updateOperationIds(parsed, methodName);
        }
        const stringified = JSON.stringify(parsed);
        yield* Effect.logDebug({ event: 'yamlParseResult', parsed: stringified });
        return stringified;
      })
    ),
    Stream.runCollect
  );
  return Chunk.toReadonlyArray(chunk);
});

// Retry up to 5 times with exponential backoff (1s base, doubling), capped at 30s between attempts.
const LLM_RETRY_SCHEDULE = Schedule.exponential(Duration.seconds(1), 2.0).pipe(
  Schedule.either(Schedule.spaced(Duration.seconds(30))),
  Schedule.intersect(Schedule.recurs(5))
);

export const callLLMWithRetry = Effect.fn('ApexOas.ApexRest.callLLMWithRetry')(function* (
  prompt: string,
  tokenLimit: number,
  onAttempt: () => void
) {
  return yield* LLMService.callLLM(prompt, undefined, tokenLimit).pipe(
    Effect.tapBoth({
      onSuccess: () => Effect.sync(onAttempt),
      onFailure: () => Effect.sync(onAttempt)
    }),
    // An empty response is never valid; treat it as a transient failure so it is retried.
    Effect.flatMap(response =>
      response === '' ? new LLMEmptyResponse({ message: 'LLM returned an empty response' }) : Effect.succeed(response)
    ),
    // A monthly rate limit won't clear within the retry window, so don't burn backoff on it — let it
    // propagate so the caller can surface it to the user instead of degrading it to empty content.
    Effect.retry({ schedule: LLM_RETRY_SCHEDULE, while: error => error._tag !== 'LLMRateLimited' }),
    Effect.mapError(cause =>
      cause._tag === 'LLMRateLimited'
        ? cause
        : new LLMRetriesExhausted({ message: `Failed after retries: ${String(cause)}` })
    )
  );
});

export const createApexRestStrategy = Effect.fn('ApexOas.ApexRest.createApexRestStrategy')(function* (
  metadata: ApexClassOASEligibleResponse,
  context: ApexClassOASGatherContextResponse
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const sourceText = yield* api.services.FsService.readFile(metadata.resourceUri.fsPath);
  const classPrompt = buildClassPrompt(context.classDetail);

  const urlMapping =
    context.classDetail.annotations.find(a => AA_CLASS_REST_ANNOTATIONS.includes(a.name))?.parameters.urlMapping ??
    `/${context.classDetail.name}/`;
  const outputTokenLimit = vscode.workspace.getConfiguration().get(APEX_OAS_OUTPUT_TOKEN_LIMIT, 750);

  const genState = yield* buildGenState(metadata, context, classPrompt, sourceText);
  // eslint-disable-next-line functional/no-let
  let llmCallCount = 0;
  const incrementLlmCallCount = () => {
    llmCallCount++;
  };

  const bid = () => {
    // First check if the class has valid REST annotations; if missing, the strategy declines via a zero bid
    const result: PromptGenerationResult = hasValidRestAnnotations(context)
      ? { maxBudget: genState.maxBudget, callCounts: genState.biddedCallCount }
      : { maxBudget: 0, callCounts: 0 };
    return Effect.succeed({ result });
  };

  const generateOAS = Effect.fn('ApexOas.ApexRest.generateOAS')(function* () {
    const promptEntries = Array.from(genState.servicePrompts.entries()).filter(([, p]) => p?.length > 0);
    yield* Effect.forEach(promptEntries, ([, prompt]) => Effect.logDebug({ event: 'prompt', prompt }));
    const responses = yield* Effect.forEach(
      promptEntries,
      ([methodName, prompt]) =>
        callLLMWithRetry(prompt, outputTokenLimit, incrementLlmCallCount).pipe(
          Effect.tap(raw => Effect.logDebug({ event: 'rawResponse', methodName, raw })),
          Effect.map(raw => [methodName, raw] as const),
          // A rate limit isn't a per-method failure to degrade to empty content — it dooms every
          // method, so propagate it and let the command surface it to the user.
          Effect.catchIf(
            error => error._tag === 'LLMRateLimited',
            error => Effect.fail(error)
          ),
          Effect.catchAll(error =>
            Effect.gen(function* () {
              yield* Effect.logDebug({ event: 'rawResponseRejected', methodName, error: String(error) });
              return [methodName, ''] as const;
            })
          )
        ),
      { concurrency: 'unbounded' }
    );
    const responseMap = new Map(responses);
    const validResponses = yield* prevalidateLLMResponse(responseMap, genState.methodsContextMap, urlMapping);
    if (validResponses.length === 0) {
      return yield* new OasGenerationFailed({ message: nls.localize('no_oas_generated') });
    }
    yield* annotateRootSpan({
      strategyName: 'ApexRest',
      biddedCallCount: genState.biddedCallCount,
      llmCallCount,
      generationSize: genState.maxBudget
    });
    return yield* combineYamlByMethod(validResponses, context.classDetail.name).pipe(
      Effect.mapError(e => new OasGenerationFailed({ message: nls.localize('failed_to_combine_oas', String(e)) }))
    );
  });

  return {
    bid,
    generateOAS
  };
});
