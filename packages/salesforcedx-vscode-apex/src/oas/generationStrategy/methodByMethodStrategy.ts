/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import { OpenAPIV3 } from 'openapi-types';
import { DocumentSymbol } from 'vscode';
import * as yaml from 'yaml';
import { nls } from '../../messages';
import {
  ApexClassOASEligibleResponse,
  ApexClassOASGatherContextResponse,
  ApexOASClassDetail,
  ApexOASMethodDetail,
  OpenAPIDoc,
  PromptGenerationResult,
  PromptGenerationStrategyBid
} from '../schemas';
import { IMPOSED_FACTOR, PROMPT_TOKEN_MAX_LIMIT, SUM_TOKEN_MAX_LIMIT } from '.';
import { GenerationStrategy } from './generationStrategy';
import { getPrompts } from './promptsHandler';

export const METHOD_BY_METHOD_STRATEGY_NAME = 'MethodByMethod';
export class MethodByMethodStrategy extends GenerationStrategy {
  async callLLMWithPrompts(): Promise<string[]> {
    try {
      const llmService = await this.getLLMServiceInterface();

      // Filter valid prompts and map them to promises
      const responsePromises = this.prompts.filter(p => p?.length > 0).map(prompt => llmService.callLLM(prompt));

      // Execute all LLM calls in parallel and store responses
      await Promise.allSettled(responsePromises).then(results => {
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            this.llmResponses.push(result.value);
          } else if (result.status === 'rejected') {
            console.log(`Promise ${index} rejected with reason:`, result.reason);
          }
        });
      });

      return this.llmResponses;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(errorMessage);
    }
  }

  public async generateOAS(): Promise<string> {
    const oas = await this.callLLMWithPrompts();
    if (oas.length > 0) {
      try {
        const combinedText = this.combineYamlByMethod(oas);
        return combinedText;
      } catch (e) {
        throw new Error(nls.localize('failed_to_combine_oas', e));
      }
    } else {
      throw new Error(nls.localize('no_oas_generated'));
    }
  }

  cleanYamlString(input: string): string {
    return input
      .replace(/^```yaml\n/, '') // Remove leading triple backtick (if any)
      .replace(/\n```$/, '') // Remove trailing triple backtick (if any)
      .replace(/```\n\s*$/, '') // Remove trailing triple backtick with new line (if any)
      .trim(); // Ensure no extra spaces
  }

  combineYamlByMethod(docs: string[]) {
    const combined: OpenAPIDoc = {
      openapi: '3.0.0',
      info: {
        title: this.context.classDetail.name,
        version: '1.0.0',
        description: `This is auto-generated OpenAPI v3 spec for ${this.context.classDetail.name}.`
      },
      paths: {},
      components: { schemas: {} }
    };

    for (const doc of docs) {
      const yamlCleanDoc = this.cleanYamlString(doc);
      const parsed = parse(yamlCleanDoc) as OpenAPIV3.Document;
      // Merge paths
      if (parsed.paths) {
        for (const [path, methods] of Object.entries(parsed.paths)) {
          if (!combined.paths[path]) {
            combined.paths[path] = {};
          }
          Object.assign(combined.paths[path], methods);
        }
      }
      // Merge components
      if (parsed.components?.schemas) {
        for (const [schema, definition] of Object.entries(parsed.components.schemas)) {
          if (!combined.components!.schemas![schema]) {
            combined.components!.schemas![schema] = definition as Record<string, any>;
          }
        }
      }
    }
    return yaml.stringify(combined);
  }

  llmResponses: string[];
  public async callLLMWithGivenPrompts(): Promise<string[]> {
    let documentContent = '';
    try {
      const llmService = await this.getLLMServiceInterface();
      documentContent = await llmService.callLLM(this.prompts[0]);
      this.llmResponses.push(documentContent);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      throw new Error(errorMessage);
    }
    return this.llmResponses;
  }

  metadata: ApexClassOASEligibleResponse;
  context: ApexClassOASGatherContextResponse;
  prompts: string[];
  strategyName: string;
  callCounts: number;
  maxBudget: number;
  methodsList: string[];
  methodsDocSymbolMap: Map<string, DocumentSymbol>;
  methodsContextMap: Map<string, ApexOASMethodDetail>;
  documentText: string;
  classPrompt: string; // The prompt for the entire class

  public constructor(metadata: ApexClassOASEligibleResponse, context: ApexClassOASGatherContextResponse) {
    super();
    this.metadata = metadata;
    this.context = context;
    this.prompts = [];
    this.strategyName = 'MethodByMethod';
    this.callCounts = 0;
    this.maxBudget = SUM_TOKEN_MAX_LIMIT * IMPOSED_FACTOR;
    this.methodsList = [];
    this.llmResponses = [];
    this.methodsDocSymbolMap = new Map();
    this.methodsContextMap = new Map();
    this.documentText = fs.readFileSync(new URL(this.metadata.resourceUri.toString()), 'utf8');
    this.classPrompt = this.buildClassPrompt(this.context.classDetail);
  }

  buildClassPrompt(classDetail: ApexOASClassDetail): string {
    let prompt = '';
    prompt += `The class name of the given method is ${classDetail.name}.\n`;
    if (classDetail.comment !== undefined) {
      prompt += `The comment of the class is ${classDetail.comment}.\n`;
    }
    return prompt;
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

      const input = this.generatePromptForMethod(methodName);
      const tokenCount = this.getPromptTokenCount(input);
      if (tokenCount <= PROMPT_TOKEN_MAX_LIMIT * IMPOSED_FACTOR) {
        this.prompts.push(input);
        this.callCounts++;
        const currentBudget = Math.floor((PROMPT_TOKEN_MAX_LIMIT - tokenCount) * IMPOSED_FACTOR);
        if (currentBudget < this.maxBudget) {
          this.maxBudget = currentBudget;
        }
      } else {
        // as long as there is one failure, the strategy will be considered failed
        this.prompts = [];
        this.callCounts = 0;
        this.maxBudget = 0;
        return {
          maxBudget: 0,
          callCounts: 0
        };
      }
    }
    return {
      maxBudget: this.maxBudget,
      callCounts: this.callCounts
    };
  }

  generatePromptForMethod(methodName: string): string {
    const prompts = getPrompts();
    let input = '';
    const methodContext = this.methodsContextMap.get(methodName);
    input += `${prompts.SYSTEM_TAG}\n${prompts.METHOD_BY_METHOD.systemPrompt}\n${prompts.END_OF_PROMPT_TAG}\n`;
    input += `${prompts.USER_TAG}\n${prompts.METHOD_BY_METHOD.USER_PROMPT}\n`;
    input += '\nThis is the Apex method the OpenAPI v3 specification should be generated for:\n```\n';
    input += this.getMethodImplementation(methodName, this.documentText);
    input += `The method name is ${methodName}.\n`;
    if (methodContext?.returnType !== undefined) {
      input += `The return type of the method is ${methodContext.returnType}.\n`;
    }
    if (methodContext?.parameterTypes?.length ?? 0 > 0) {
      input += `The parameter types of the method are ${methodContext!.parameterTypes.join(', ')}.\n`;
    }
    if (methodContext?.modifiers?.length ?? 0 > 0) {
      input += `The modifiers of the method are ${methodContext!.modifiers.join(', ')}.\n`;
    }
    if (methodContext?.annotations?.length ?? 0 > 0) {
      input += `The annotations of the method are ${methodContext!.annotations.join(', ')}.\n`;
    }
    if (methodContext?.comment !== undefined) {
      input += `The comment of the method is ${methodContext!.comment}.\n`;
    }
    input += this.classPrompt;
    input += `\n\`\`\`\n${prompts.END_OF_PROMPT_TAG}\n${prompts.ASSISTANT_TAG}\n`;

    return input;
  }

  getMethodImplementation(methodName: string, doc: string): string {
    const methodSymbol = this.methodsDocSymbolMap.get(methodName);
    if (methodSymbol) {
      const startLine = methodSymbol.range.start.line;
      const endLine = methodSymbol.range.end.line;
      const lines = doc.split('\n').map(line => line.trim());
      const method = lines.slice(startLine - 1, endLine + 1).join('\n');
      return method;
    } else {
      throw new Error(nls.localize('method_not_found_in_doc_symbols', methodName));
    }
  }
}
