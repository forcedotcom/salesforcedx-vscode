/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { readFile } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import type { DocumentSymbol } from 'vscode-languageserver-protocol';
import { nls } from '../../../messages/nls';
import { cleanupGeneratedDoc, hasValidRestAnnotations, parseOASDocFromJson } from '../../../oasUtils';
import { AA_CLASS_REST_ANNOTATIONS } from '../../../settings';
import { telemetryService } from '../../../telemetry/telemetryService';
import GenerationInteractionLogger from '../../generationInteractionLogger';
import {
  ApexClassOASEligibleResponse,
  ApexClassOASGatherContextResponse,
  ApexOASMethodDetail,
  PromptGenerationResult,
  PromptGenerationStrategyBid
} from '../../schemas';
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
import {
  GenerationStrategy,
  StrategyTelemetry,
  getLLMServiceInterface,
  getOutputTokenLimit,
  getPromptTokenCount
} from '../generationStrategy';
import { openAPISchemaV3Guided } from '../openapi3.schema';

const gil = GenerationInteractionLogger.getInstance();

const STRATEGY_NAME = 'ApexRest';
const BETA_INFO = 'OpenAPI documents generated from Apex classes using Apex REST annotations are in beta.';

const resolveLLMResponses = async (serviceRequests: Map<string, Promise<string>>): Promise<Map<string, string>> => {
  const methodNames = Array.from(serviceRequests.keys());
  const serviceResponses = await Promise.allSettled(Array.from(serviceRequests.values()));
  return new Map(
    methodNames.map((methodName, index) => {
      const result = serviceResponses[index];
      if (result.status === 'fulfilled') {
        gil.addRawResponse(result.value);
        return [methodName, result.value];
      }
      gil.addRawResponse(`Promise ${index} rejected with reason: ${JSON.stringify(result.reason)}`);
      console.log(`Promise ${index} rejected with reason:`, result.reason);
      return [methodName, ''];
    })
  );
};

export const createApexRestStrategy = async (
  metadata: ApexClassOASEligibleResponse,
  context: ApexClassOASGatherContextResponse
): Promise<GenerationStrategy> => {
  const sourceText = await readFile(metadata.resourceUri.fsPath);
  const classPrompt = buildClassPrompt(context.classDetail);
  const restResourceAnnotation = context.classDetail.annotations.find(a => AA_CLASS_REST_ANNOTATIONS.includes(a.name));
  const urlMapping = restResourceAnnotation?.parameters.urlMapping ?? `/${context.classDetail.name}/`;
  const oasSchema = JSON.stringify(openAPISchemaV3Guided);
  const outputTokenLimit = getOutputTokenLimit();

  const methodsDocSymbolMap = new Map<string, DocumentSymbol>();
  const methodsContextMap = new Map<string, ApexOASMethodDetail>();
  const serviceRequests = new Map<string, Promise<string>>();
  const servicePrompts = new Map<string, string>();
  let serviceResponses = new Map<string, string>();

  let biddedCallCount = 0;
  let maxBudget = SUM_TOKEN_MAX_LIMIT * IMPOSED_FACTOR;
  let resolutionAttempts = 0;

  const lock = Effect.runSync(Effect.makeSemaphore(1));
  const incrementResolutionAttempts = () =>
    Effect.runPromise(
      lock.withPermits(1)(
        Effect.sync(() => {
          resolutionAttempts++;
        })
      )
    );

  const prevalidateLLMResponse = (): string[] => {
    const validResponses: string[] = [];
    for (const [methodName, response] of serviceResponses) {
      if (response === '') {
        console.log(`LLM response for ${methodName} is empty.`);
        continue;
      }
      try {
        const cleanedResponse = cleanupGeneratedDoc(response);
        gil.addCleanedResponse(cleanedResponse);
        try {
          const parsed = parseOASDocFromJson(cleanedResponse);
          // remove unrelated methods
          excludeUnrelatedMethods(parsed, methodName, methodsContextMap);
          // remove non-2xx responses
          excludeNon2xxResponses(parsed);
          // make sure parameters in path are in the request path, and the request path starts with the urlMapping
          const parametersInPath = extractParametersInPath(parsed);
          if (parsed.paths) {
            for (const [path, methods] of Object.entries(parsed.paths)) {
              const validatedPath = formatUrlPath(parametersInPath, urlMapping);
              delete parsed.paths[path];
              parsed.paths[validatedPath] = methods;
            }
          }
          // update operationId with the methodName
          if (parsed.paths) {
            updateOperationIds(parsed, methodName);
          }
          gil.addYamlParseResult(JSON.stringify(parsed));
          validResponses.push(JSON.stringify(parsed));
        } catch (e) {
          gil.addYamlParseResult(`JSON parse failed with error ${e}`);
          console.debug(`JSON parse failed with error ${e}`);
        }
      } catch (e) {
        gil.addCleanedResponse(`Cleanup failed with error ${e}`);
      }
    }
    return validResponses;
  };

  const executeWithRetry = async (fn: () => Promise<string>, retryLimit: number): Promise<string> => {
    let attempts = 0;
    while (attempts < retryLimit) {
      await incrementResolutionAttempts();
      try {
        const response = await fn();
        // Extract result if response is an object with result property, otherwise use as-is
        const result =
          typeof response === 'object' && response !== null && 'result' in response
            ? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              (response as { result: string }).result
            : response;
        // Return the result; cleanup and validation will happen in prevalidateLLMResponse
        return result;
      } catch (error) {
        attempts++;
        telemetryService.sendException(
          'OasLlmResultFailedParse',
          `attempt: ${attempts} of ${retryLimit}: ${error instanceof Error ? error.message : String(error)}`
        );
        if (attempts >= retryLimit) {
          throw new Error(
            `Failed after ${retryLimit} attempts: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }
    throw new Error('Unexpected error in executeWithRetry');
  };

  const resolveOASContent = async (): Promise<string[]> => {
    try {
      const llmService = await getLLMServiceInterface();
      for (const [methodName, prompt] of servicePrompts) {
        if (prompt?.length > 0) {
          gil.addPrompt(prompt);
          serviceRequests.set(
            methodName,
            executeWithRetry(() => llmService.callLLM(prompt, undefined, outputTokenLimit), 3)
          );
        }
      }
      serviceResponses = await resolveLLMResponses(serviceRequests);
      return prevalidateLLMResponse();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(errorMessage);
    }
  };

  const generate = async (): Promise<PromptGenerationResult> => {
    const list = (metadata.symbols ?? []).filter(s => s.isApexOasEligible);
    for (const symbol of list) {
      const methodName = symbol.docSymbol.name;
      methodsDocSymbolMap.set(methodName, symbol.docSymbol);
      const methodDetail = context.methods.find(m => m.name === methodName);
      if (methodDetail) {
        methodsContextMap.set(methodName, methodDetail);
      }

      const input = await generatePromptForMethod(
        methodName,
        sourceText,
        methodsDocSymbolMap,
        methodsContextMap,
        classPrompt
      );
      const tokenCount = getPromptTokenCount(input);
      if (tokenCount <= PROMPT_TOKEN_MAX_LIMIT * IMPOSED_FACTOR) {
        servicePrompts.set(methodName, input);
        biddedCallCount++;
        const currentBudget = Math.floor((PROMPT_TOKEN_MAX_LIMIT - tokenCount) * IMPOSED_FACTOR);
        if (currentBudget < maxBudget) {
          maxBudget = currentBudget;
        }
      } else {
        // as long as there is one failure, the strategy will be considered failed
        servicePrompts.clear();
        biddedCallCount = 0;
        maxBudget = 0;
        return { maxBudget: 0, callCounts: 0 };
      }
    }
    return { maxBudget, callCounts: biddedCallCount };
  };

  const bid = async (): Promise<PromptGenerationStrategyBid> => {
    // First check if the class has valid REST annotations
    if (!hasValidRestAnnotations(context)) {
      return { result: { maxBudget: 0, callCounts: 0 } };
    }
    const generationResult = await generate();
    return { result: generationResult };
  };

  const generateOAS = async (): Promise<string> => {
    const oas = await resolveOASContent();
    if (oas.length > 0) {
      try {
        return combineYamlByMethod(oas, context.classDetail.name);
      } catch (e) {
        throw new Error(nls.localize('failed_to_combine_oas', e));
      }
    }
    throw new Error(nls.localize('no_oas_generated'));
  };

  const getTelemetry = (): StrategyTelemetry => ({
    strategyName: STRATEGY_NAME,
    biddedCallCount,
    llmCallCount: resolutionAttempts,
    generationSize: maxBudget,
    outputTokenLimit
  });

  return {
    strategyName: STRATEGY_NAME,
    betaInfo: BETA_INFO,
    get openAPISchema() {
      return oasSchema;
    },
    bid,
    generateOAS,
    getTelemetry
  };
};
