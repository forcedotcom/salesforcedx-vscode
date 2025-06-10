/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import { DocumentSymbol } from 'vscode';
import { SUM_TOKEN_MAX_LIMIT, IMPOSED_FACTOR, PROMPT_TOKEN_MAX_LIMIT } from '..';
import { nls } from '../../../messages';
import { cleanupGeneratedDoc, parseOASDocFromJson } from '../../../oasUtils';
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
import {
  formatUrlPath,
  extractParametersInPath,
  excludeNon2xxResponses,
  excludeUnrelatedMethods,
  updateOperationIds,
  combineYamlByMethod
} from '../formatUtils';
import { GenerationStrategy } from '../generationStrategy';
import { openAPISchema_v3_0_guided } from '../openapi3.schema';

const gil = GenerationInteractionLogger.getInstance();

export class JsonMethodByMethodStrategy extends GenerationStrategy {
  llmRequests: Map<string, Promise<string>>;
  llmResponses: Map<string, string>;
  metadata: ApexClassOASEligibleResponse;
  context: ApexClassOASGatherContextResponse;
  prompts: Map<string, string>;
  strategyName: string;
  biddedCallCount: number;
  maxBudget: number;
  methodsList: string[];
  methodsDocSymbolMap: Map<string, DocumentSymbol>;
  methodsContextMap: Map<string, ApexOASMethodDetail>;
  documentText: string;
  classPrompt: string; // The prompt for the entire class
  urlMapping: string;
  openAPISchema: string;

  public constructor(metadata: ApexClassOASEligibleResponse, context: ApexClassOASGatherContextResponse) {
    super();
    this.metadata = metadata;
    this.context = context;
    this.prompts = new Map();
    this.strategyName = 'JsonMethodByMethod';
    this.biddedCallCount = 0;
    this.maxBudget = SUM_TOKEN_MAX_LIMIT * IMPOSED_FACTOR;
    this.methodsList = [];
    this.llmResponses = new Map();
    this.methodsDocSymbolMap = new Map();
    this.methodsContextMap = new Map();
    this.llmRequests = new Map();
    this.documentText = fs.readFileSync(new URL(this.metadata.resourceUri.toString()), 'utf8');
    this.classPrompt = buildClassPrompt(this.context.classDetail);
    const restResourceAnnotation = this.context.classDetail.annotations.find(a => a.name === 'RestResource');
    this.urlMapping = restResourceAnnotation?.parameters.urlMapping ?? `/${this.context.classDetail.name}/`;
    this.openAPISchema = JSON.stringify(openAPISchema_v3_0_guided);
  }

  async resolveLLMResponses(llmRequests: Map<string, Promise<string>>): Promise<Map<string, string>> {
    const methodNames = Array.from(llmRequests.keys());
    const llmResponses = await Promise.allSettled(Array.from(llmRequests.values()));
    return new Map(
      methodNames.map((methodName, index) => {
        const result = llmResponses[index];
        if (result.status === 'fulfilled') {
          gil.addRawResponse(result.value);
          return [methodName, result.value];
        } else {
          gil.addRawResponse(`Promise ${index} rejected with reason: ${result.reason}`);
          console.log(`Promise ${index} rejected with reason:`, result.reason);
          return [methodName, ''];
        }
      })
    );
  }

  prevalidateLLMResponse(): string[] {
    const validResponses: string[] = [];
    for (const [methodName, response] of this.llmResponses) {
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

  async callLLMWithPrompts(retryLimit: number = 3): Promise<string[]> {
    try {
      const llmService = await this.getLLMServiceInterface();

      for (const [methodName, prompt] of this.prompts) {
        if (prompt?.length > 0) {
          gil.addPrompt(prompt);
          this.llmRequests.set(
            methodName,
            this.executeWithRetry(
              () =>
                this.includesOASSchema()
                  ? llmService.callLLM(prompt, undefined, this.outputTokenLimit, {
                      parameters: { guided_json: this.openAPISchema }
                    })
                  : llmService.callLLM(prompt, undefined, this.outputTokenLimit),
              retryLimit
            )
          );
        }
      }

      this.llmResponses = await this.resolveLLMResponses(this.llmRequests);
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
      await this.incrementCallCount();
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

  public async generateOAS(): Promise<string> {
    const oas = await this.callLLMWithPrompts();
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

  public bid(): PromptGenerationStrategyBid {
    const generationResult = this.generate();
    return {
      result: generationResult
    };
  }

  public generate(): PromptGenerationResult {
    const list = (this.metadata.symbols ?? []).filter(s => s.isApexOasEligible);
    for (const symbol of list) {
      const methodName = symbol.docSymbol.name;
      this.methodsDocSymbolMap.set(methodName, symbol.docSymbol);
      const methodDetail = this.context.methods.find(m => m.name === methodName);
      if (methodDetail) {
        this.methodsContextMap.set(methodName, methodDetail);
      }

      const input = generatePromptForMethod(
        methodName,
        this.documentText,
        this.methodsDocSymbolMap,
        this.methodsContextMap,
        this.classPrompt
      );
      const tokenCount = this.getPromptTokenCount(input);
      if (tokenCount <= PROMPT_TOKEN_MAX_LIMIT * IMPOSED_FACTOR) {
        this.prompts.set(methodName, input);
        this.biddedCallCount++;
        const currentBudget = Math.floor((PROMPT_TOKEN_MAX_LIMIT - tokenCount) * IMPOSED_FACTOR);
        if (currentBudget < this.maxBudget) {
          this.maxBudget = currentBudget;
        }
      } else {
        // as long as there is one failure, the strategy will be considered failed
        this.prompts.clear();
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
}
