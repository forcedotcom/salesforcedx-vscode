/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as ejs from 'ejs';
import * as fs from 'fs';
import { JSONPath } from 'jsonpath-plus';
import { OpenAPIV3 } from 'openapi-types';
import { DocumentSymbol } from 'vscode';
import { SUM_TOKEN_MAX_LIMIT, IMPOSED_FACTOR, PROMPT_TOKEN_MAX_LIMIT } from '..';
import { nls } from '../../../messages';
import { cleanupGeneratedDoc, ejsTemplateHelpers, EjsTemplatesEnum, parseOASDocFromJson } from '../../../oasUtils';
import { getTelemetryService } from '../../../telemetry/telemetry';
import GenerationInteractionLogger from '../../generationInteractionLogger';
import {
  ApexAnnotationDetail,
  ApexClassOASEligibleResponse,
  ApexClassOASGatherContextResponse,
  ApexOASClassDetail,
  ApexOASMethodDetail,
  OpenAPIDoc,
  PromptGenerationResult,
  PromptGenerationStrategyBid,
  HttpRequestMethod,
  httpMethodMap
} from '../../schemas';
import { GenerationStrategy } from '../generationStrategy';
import { openAPISchema_v3_0_guided } from '../openapi-3.schema';

const gil = GenerationInteractionLogger.getInstance();

export const METHOD_BY_METHOD_STRATEGY_NAME = 'JsonMethodByMethod';
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
    this.strategyName = 'MethodByMethod';
    this.biddedCallCount = 0;
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
        const cleandResponse = cleanupGeneratedDoc(response);
        gil.addCleanedResponse(cleandResponse);
        try {
          const parsed = parseOASDocFromJson(cleandResponse);
          // remove unrelated methods
          this.excludeUnrelatedMethods(parsed, methodName);
          // remove non-2xx responses
          this.excludeNon2xxResponses(parsed);
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
            this.updateOperationIds(parsed, methodName);
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

  formatUrlPath(parametersInPath: string[]): string {
    let updatedPath = this.urlMapping.replace(/\/$|\/\*$/, '').trim() || '/';
    parametersInPath.forEach(parameter => {
      updatedPath += `/{${parameter}}`;
    });
    return updatedPath;
  }

  /* Extracts parameters in path from the operation object */
  extractParametersInPath(oas: OpenAPIV3.Document): string[] {
    return JSONPath<OpenAPIV3.ParameterObject[]>({ path: '$..parameters[?(@.in=="path")]', json: oas })
      .sort((param1, param2) => {
        return param1.required === param2.required ? 0 : param1.required ? -1 : 1;
      })
      .map(param => param.name);
  }

  excludeNon2xxResponses(oas: OpenAPIV3.Document) {
    JSONPath({
      path: '$.paths.*.*.responses',
      json: oas,
      callback: operation => {
        for (const [statusCode, response] of Object.entries(operation)) {
          if (!statusCode.startsWith('2')) {
            delete operation[statusCode];
          }
        }
      }
    });
  }

  // This check is compromised for TDX http deliverables
  excludeUnrelatedMethods(oas: OpenAPIV3.Document, methodName: string) {
    const httpMethod = this.getMethodTypeFromAnnotation(methodName);

    JSONPath({
      path: '$.paths.*', // Access each method under each path
      json: oas,
      callback: (operation, type, fullPath) => {
        for (const [method, body] of Object.entries(operation)) {
          if (method !== httpMethod) {
            delete operation[method];
          }
        }
      }
    });
  }

  updateOperationIds(parsed: OpenAPIV3.Document, methodName: string) {
    JSONPath({
      path: '$.paths.*.*',
      json: parsed,
      callback: operation => {
        if (operation) {
          operation.operationId = methodName;
        }
      }
    });
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
    const telemetryService = await getTelemetryService();
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
          'OasLlmresultFailedParse',
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

  getMethodTypeFromAnnotation(methodName: string): HttpRequestMethod {
    const methodContext = this.methodsContextMap.get(methodName);
    if (methodContext) {
      const httpMethodAnnotation = methodContext.annotations.find(annotation =>
        ['HttpGet', 'HttpPost', 'HttpPut', 'HttpPatch', 'HttpDelete'].includes(annotation.name)
      );
      if (httpMethodAnnotation) {
        return httpMethodMap.get(httpMethodAnnotation.name) as HttpRequestMethod;
      }
    }
    throw new Error(nls.localize('method_not_found_in_doc_symbols', methodName));
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
      paths: {}
    };

    for (const doc of docs) {
      try {
        const cleanedOASDoc = cleanupGeneratedDoc(doc);
        const parsed = parseOASDocFromJson(cleanedOASDoc);

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

    return JSON.stringify(combined);
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

  generatePromptForMethod(methodName: string): string {
    const templatePath = ejsTemplateHelpers.getTemplatePath(EjsTemplatesEnum.METHOD_BY_METHOD);

    let additionalUserPrompts = '';
    const methodImplementation = this.getMethodImplementation(methodName, this.documentText);
    const methodContext = this.methodsContextMap.get(methodName);
    additionalUserPrompts += this.getPromptForMethodContext(methodContext);
    try {
      const renderedTemplate = ejs.render(fs.readFileSync(templatePath.fsPath, 'utf8'), {
        classPrompt: this.classPrompt,
        methodImplementation,
        additionalUserPrompts
      });

      return renderedTemplate;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  private getPromptForMethodContext(methodContext: ApexOASMethodDetail | undefined): string {
    if (!methodContext) return '';
    let methodContextPrompt = '';
    methodContext.annotations.forEach(annotation => {
      switch (annotation.name) {
        case 'HttpGet':
          methodContextPrompt += 'For the given method only produce the GET verb.\n';
          break;
        case 'HttpPatch':
          methodContextPrompt += 'For the given method only produce the PATCH verb.\n';
          break;
        case 'HttpPost':
          methodContextPrompt += 'For the given method only produce the POST verb.\n';
          break;
        case 'HttpPut':
          methodContextPrompt += 'For the given method only produce the PUT verb.\n';
          break;
        case 'HttpDelete':
          methodContextPrompt += 'For the given method only produce the DELETE verb.\n';
          break;
      }
    });
    return methodContextPrompt;
  }

  private buildClassPrompt(classDetail: ApexOASClassDetail): string {
    let prompt = '';
    prompt += `The class name of the given method is ${classDetail.name}.\n`;
    if (classDetail.annotations.length > 0) {
      prompt += `The class is annotated with ${this.getAnnotationsWithParameters(classDetail.annotations)}.\n`;
    }

    if (classDetail.comment !== undefined) {
      prompt += `The documentation of the class is ${classDetail.comment.replace(/\/\*\*([\s\S]*?)\*\//g, '').trim()}.\n`;
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
