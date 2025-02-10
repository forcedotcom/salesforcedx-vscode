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
  ApexAnnotationDetail,
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
  llmRequests: Map<string, Promise<string>>;
  llmResponses: Map<string, string>;
  metadata: ApexClassOASEligibleResponse;
  context: ApexClassOASGatherContextResponse;
  prompts: Map<string, string>;
  strategyName: string;
  callCounts: number;
  maxBudget: number;
  methodsList: string[];
  methodsDocSymbolMap: Map<string, DocumentSymbol>;
  methodsContextMap: Map<string, ApexOASMethodDetail>;
  documentText: string;
  classPrompt: string; // The prompt for the entire class
  urlMapping: string;

  async resolveLLMResponses(llmRequests: Map<string, Promise<string>>): Promise<Map<string, string>> {
    const methodNames = Array.from(llmRequests.keys());
    const llmResponses = await Promise.allSettled(Array.from(llmRequests.values()));
    return new Map(
      methodNames.map((methodName, index) => {
        const result = llmResponses[index];
        if (result.status === 'fulfilled') {
          return [methodName, result.value];
        } else {
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
      const parsed = yaml.parse(this.cleanYamlString(response)) as OpenAPIV3.Document;
      // make sure parameters in path are in the request path, and the request path starts with the urlMapping
      const parametersInPath = this.extractParametersInPath(parsed);
      if (parsed.paths) {
        for (const [path, methods] of Object.entries(parsed.paths)) {
          const validatedPath = this.formatUrlPath(parametersInPath);
          delete parsed.paths[path];
          parsed.paths[validatedPath] = methods;
        }
      }
      // update operationId with the methodName
      if (parsed.paths) {
        for (const path in parsed.paths) {
          for (const method in parsed.paths[path]) {
            const operation = parsed.paths[path][method as keyof (typeof parsed.paths)[string]] as any;
            if (operation) {
              operation.operationId = methodName;
            }
          }
        }
      }
      validResponses.push(yaml.stringify(parsed));
    }
    return validResponses;
  }

  formatUrlPath(parametersInPath: string[]): string {
    let updatedPath = this.urlMapping.replace(/\/$|\/\*$/, '').trim() || '/';
    parametersInPath.forEach(parameter => {
      updatedPath += `/{${parameter}}`;
    });
    return updatedPath;
  }

  /* Extracts parameters in path from the operation object */
  extractParametersInPath(oas: OpenAPIV3.Document): string[] {
    const parametersArray: string[] = [];
    if (oas.paths) {
      for (const path in oas.paths) {
        for (const method in oas.paths[path]) {
          const operation = oas.paths[path][method as keyof (typeof oas.paths)[string]] as any;
          if (operation.parameters) {
            operation.parameters.forEach((param: any) => {
              if (param.in === 'path') {
                parametersArray.push(param.name);
              }
            });
          }
        }
      }
    }

    return parametersArray;
  }

  async callLLMWithPrompts(): Promise<string[]> {
    try {
      const llmService = await this.getLLMServiceInterface();

      // Filter valid prompts and map them to promises
      for (const [methodName, prompt] of this.prompts) {
        if (prompt?.length > 0) {
          this.llmRequests.set(methodName, llmService.callLLM(prompt));
        }
      }
      this.llmResponses = await this.resolveLLMResponses(this.llmRequests);
      return this.prevalidateLLMResponse();
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
      servers: [
        {
          url: '/services/apexrest/'
        }
      ],

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
      try {
        const parsed = yaml.parse(yamlCleanDoc) as OpenAPIV3.Document;

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
      } catch (e) {
        console.debug(e);
        throw e;
      }
    }

    return yaml.stringify(combined);
  }

  public constructor(metadata: ApexClassOASEligibleResponse, context: ApexClassOASGatherContextResponse) {
    super();
    this.metadata = metadata;
    this.context = context;
    this.prompts = new Map();
    this.strategyName = 'MethodByMethod';
    this.callCounts = 0;
    this.maxBudget = SUM_TOKEN_MAX_LIMIT * IMPOSED_FACTOR;
    this.methodsList = [];
    this.llmResponses = new Map();
    this.methodsDocSymbolMap = new Map();
    this.methodsContextMap = new Map();
    this.llmRequests = new Map();
    this.documentText = fs.readFileSync(new URL(this.metadata.resourceUri.toString()), 'utf8');
    this.classPrompt = this.buildClassPrompt(this.context.classDetail);
    const restResourceAnnotation = this.context.classDetail.annotations.find(a => a.name === 'RestResource');
    this.urlMapping = restResourceAnnotation?.parameters.urlMapping ?? `/${this.context.classDetail.name}/`;
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
        this.prompts.set(methodName, input);
        this.callCounts++;
        const currentBudget = Math.floor((PROMPT_TOKEN_MAX_LIMIT - tokenCount) * IMPOSED_FACTOR);
        if (currentBudget < this.maxBudget) {
          this.maxBudget = currentBudget;
        }
      } else {
        // as long as there is one failure, the strategy will be considered failed
        this.prompts.clear();
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
    input += `${prompts.SYSTEM_TAG}\n${prompts.systemPrompt}\n${prompts.END_OF_PROMPT_TAG}\n`;
    input += `${prompts.USER_TAG}\n${prompts.METHOD_BY_METHOD.USER_PROMPT}\n`;
    input += '\nThis is the Apex method the OpenAPI v3 specification should be generated for:\n```\n';
    input += this.getMethodImplementation(methodName, this.documentText);
    input += `The method name is ${methodName}.\n`;
    input += `The operationId in the OAS result must be ${methodName}.\n`;
    if (methodContext?.returnType !== undefined) {
      input += `The return type of the method is ${methodContext.returnType}.\n`;
    }
    if (methodContext?.parameterTypes?.length ?? 0 > 0) {
      input += `The parameter types of the method are ${methodContext!.parameterTypes.join(', ')}.\n`;
    }
    if (methodContext?.modifiers?.length ?? 0 > 0) {
      input += `The modifiers of the method are ${methodContext!.modifiers.join(', ')}.\n`;
    }
    if (methodContext?.annotations && methodContext.annotations.length > 0) {
      input += this.getAnnotationsWithParameters(methodContext.annotations);
    }
    if (methodContext?.comment !== undefined) {
      input += `The comment of the method is ${methodContext!.comment}.\n`;
    }
    input += this.classPrompt;
    input += `\n\`\`\`\n${prompts.END_OF_PROMPT_TAG}\n${prompts.ASSISTANT_TAG}\n`;

    return input;
  }

  private buildClassPrompt(classDetail: ApexOASClassDetail): string {
    let prompt = '';
    prompt += `The class name of the given method is ${classDetail.name}.\n`;
    if (classDetail.annotations.length > 0) {
      prompt += `The class is annotated with ${this.getAnnotationsWithParameters(classDetail.annotations)}.\n`;
    }

    if (classDetail.comment !== undefined) {
      prompt += `The comment of the class is ${classDetail.comment}.\n`;
    }

    return prompt;
  }

  private getAnnotationsWithParameters(annotations: ApexAnnotationDetail[]): string {
    const annotationsStr =
      annotations
        .map(annotation => {
          const paramsEntries = Object.entries(annotation.parameters);
          const paramsAsStr =
            paramsEntries.length > 0
              ? paramsEntries.map(([key, value]) => `${key}: ${value}`).join(', ') + '\n'
              : undefined;
          return paramsAsStr
            ? `Annotation name: ${annotation.name} , Parameters: ${paramsAsStr}`
            : `Annotation name: ${annotation.name}`;
        })
        .join(', ') + '\n';
    return annotationsStr;
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
