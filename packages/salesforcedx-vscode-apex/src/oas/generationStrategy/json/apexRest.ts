/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { readFile } from '@salesforce/salesforcedx-utils-vscode';
import { DocumentSymbol } from 'vscode';
import { nls } from '../../../messages';
import { cleanupGeneratedDoc, hasValidRestAnnotations, parseOASDocFromJson } from '../../../oasUtils';
import { retrieveAAClassRestAnnotations } from '../../../settings';
import { getTelemetryService } from '../../../telemetry/telemetry';
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
import { GenerationStrategy } from '../generationStrategy';
import { openAPISchema_v3_0_guided } from '../openapi3.schema';

const gil = GenerationInteractionLogger.getInstance();

export class ApexRestStrategy extends GenerationStrategy {
  private methodsDocSymbolMap: Map<string, DocumentSymbol>;
  private methodsContextMap: Map<string, ApexOASMethodDetail>;
  private urlMapping: string;

  constructor(metadata: ApexClassOASEligibleResponse, context: ApexClassOASGatherContextResponse, sourceText: string) {
    super(
      metadata,
      context,
      'ApexRest',
      0,
      SUM_TOKEN_MAX_LIMIT * IMPOSED_FACTOR,
      'OpenAPI documents generated from Apex classes using Apex REST annotations are in beta.'
    );
    this.methodsDocSymbolMap = new Map();
    this.methodsContextMap = new Map();
    this.sourceText = sourceText;
    this.classPrompt = buildClassPrompt(this.context.classDetail);
    const restResourceAnnotation = this.context.classDetail.annotations.find(a =>
      retrieveAAClassRestAnnotations().includes(a.name)
    );
    this.urlMapping = restResourceAnnotation?.parameters.urlMapping ?? `/${this.context.classDetail.name}/`;
    this.oasSchema = JSON.stringify(openAPISchema_v3_0_guided);
  }

  public static async initialize(
    metadata: ApexClassOASEligibleResponse,
    context: ApexClassOASGatherContextResponse
  ): Promise<ApexRestStrategy> {
    const sourceText = await readFile(metadata.resourceUri.fsPath);
    const strategy = new ApexRestStrategy(metadata, context, sourceText);
    return strategy;
  }

  public async resolveLLMResponses(serviceRequests: Map<string, Promise<string>>): Promise<Map<string, string>> {
    const methodNames = Array.from(serviceRequests.keys());
    const serviceResponses = await Promise.allSettled(Array.from(serviceRequests.values()));
    return new Map(
      methodNames.map((methodName, index) => {
        const result = serviceResponses[index];
        if (result.status === 'fulfilled') {
          gil.addRawResponse(result.value);
          return [methodName, result.value];
        } else {
          gil.addRawResponse(`Promise ${index} rejected with reason: ${JSON.stringify(result.reason)}`);
          console.log(`Promise ${index} rejected with reason:`, result.reason);
          return [methodName, ''];
        }
      })
    );
  }

  private prevalidateLLMResponse(): string[] {
    const validResponses: string[] = [];
    for (const [methodName, response] of this.serviceResponses) {
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
          excludeUnrelatedMethods(parsed, methodName, this.methodsContextMap);
          // remove non-2xx responses
          excludeNon2xxResponses(parsed);
          // make sure parameters in path are in the request path, and the request path starts with the urlMapping
          const parametersInPath = extractParametersInPath(parsed);
          if (parsed.paths) {
            for (const [path, methods] of Object.entries(parsed.paths)) {
              const validatedPath = formatUrlPath(parametersInPath, this.urlMapping);
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
  }

  public async generateOAS(): Promise<string> {
    const oas = await this.resolveOASContent();
    if (oas.length > 0) {
      try {
        const combinedText = combineYamlByMethod(oas, this.context.classDetail.name);
        return combinedText;
      } catch (e) {
        throw new Error(nls.localize('failed_to_combine_oas', e));
      }
    } else {
      throw new Error(nls.localize('no_oas_generated'));
    }
  }

  private async resolveOASContent(): Promise<string[]> {
    try {
      const llmService = await this.getLLMServiceInterface();

      for (const [methodName, prompt] of this.servicePrompts) {
        if (prompt?.length > 0) {
          gil.addPrompt(prompt);
          this.serviceRequests.set(
            methodName,
            this.executeWithRetry(
              () =>
                this.includesOASSchema()
                  ? llmService.callLLM(prompt, undefined, this.outputTokenLimit, {
                      parameters: { guided_json: this.oasSchema }
                    })
                  : llmService.callLLM(prompt, undefined, this.outputTokenLimit),
              3
            )
          );
        }
      }

      this.serviceResponses = await this.resolveLLMResponses(this.serviceRequests);
      return this.prevalidateLLMResponse();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(errorMessage);
    }
  }

  private async executeWithRetry(fn: () => Promise<string>, retryLimit: number): Promise<string> {
    const telemetryService = getTelemetryService();
    let attempts = 0;
    while (attempts < retryLimit) {
      await this.incrementResolutionAttempts();
      const result = await fn();
      // Attempt to parse the result to ensure it's valid JSON
      try {
        JSON.parse(result);
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
  }

  public async bid(): Promise<PromptGenerationStrategyBid> {
    // First check if the class has valid REST annotations
    if (!hasValidRestAnnotations(this.context)) {
      return {
        result: {
          maxBudget: 0,
          callCounts: 0
        }
      };
    }

    const generationResult = await this.generate();
    return {
      result: generationResult
    };
  }

  private async generate(): Promise<PromptGenerationResult> {
    const list = (this.metadata.symbols ?? []).filter(s => s.isApexOasEligible);
    for (const symbol of list) {
      const methodName = symbol.docSymbol.name;
      this.methodsDocSymbolMap.set(methodName, symbol.docSymbol);
      const methodDetail = this.context.methods.find(m => m.name === methodName);
      if (methodDetail) {
        this.methodsContextMap.set(methodName, methodDetail);
      }

      const input = await generatePromptForMethod(
        methodName,
        this.sourceText,
        this.methodsDocSymbolMap,
        this.methodsContextMap,
        this.classPrompt
      );
      const tokenCount = this.getPromptTokenCount(input);
      if (tokenCount <= PROMPT_TOKEN_MAX_LIMIT * IMPOSED_FACTOR) {
        this.servicePrompts.set(methodName, input);
        this.biddedCallCount++;
        const currentBudget = Math.floor((PROMPT_TOKEN_MAX_LIMIT - tokenCount) * IMPOSED_FACTOR);
        if (currentBudget < this.maxBudget) {
          this.maxBudget = currentBudget;
        }
      } else {
        // as long as there is one failure, the strategy will be considered failed
        this.servicePrompts.clear();
        this.biddedCallCount = 0;
        this.maxBudget = 0;
        return {
          maxBudget: 0,
          callCounts: 0
        };
      }
    }
    return {
      maxBudget: this.maxBudget,
      callCounts: this.biddedCallCount
    };
  }

  public get openAPISchema(): string {
    return this.oasSchema;
  }
}
