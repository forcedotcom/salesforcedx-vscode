/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import { join } from 'node:path';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { SF_LOG_LEVEL_SETTING } from '../constants';

export default class GenerationInteractionLogger {
  private static instance: GenerationInteractionLogger;

  private apexClassOASEligibleRequest: Record<string, unknown>[] = [];
  private apexClassOASEligibleResponse: Record<string, unknown>[] = [];
  private apexClassOASGatherContextResponse: Record<string, unknown> = {};
  private prompts: string[] = [];
  private rawResponses: string[] = [];
  private cleanedResponses: string[] = [];
  private parseResults: string[] = [];
  private diagnostics: vscode.Diagnostic[] = [];
  private postGenDoc: string = '';
  private finalDoc: string = '';
  private sourceUnderStudy: string = '';
  private logLevel: string = 'fatal';
  private generationStrategy: string = '';
  private guidedJson: string = '';
  private outputTokenLimit: number = 0;

  private constructor() {}

  public static getInstance(): GenerationInteractionLogger {
    if (!GenerationInteractionLogger.instance) {
      GenerationInteractionLogger.instance = new GenerationInteractionLogger();
      const config = vscode.workspace.getConfiguration();
      GenerationInteractionLogger.instance.logLevel = config.get(SF_LOG_LEVEL_SETTING, 'fatal');
    }
    return GenerationInteractionLogger.instance;
  }

  public addApexClassOASEligibleRequest(request: Record<string, unknown>[] | undefined): void {
    if (request) this.apexClassOASEligibleRequest = request;
  }

  public addApexClassOASEligibleResponse(response: Record<string, unknown>[] | undefined): void {
    if (response) this.apexClassOASEligibleResponse = response;
  }

  public addApexClassOASGatherContextResponse(response: Record<string, unknown> | undefined): void {
    if (response) this.apexClassOASGatherContextResponse = response;
  }

  public addPrompt(prompt: string | string[]): void {
    Array.isArray(prompt) ? this.prompts.push(...prompt) : this.prompts.push(prompt);
  }

  public addRawResponse(rawResponse: string | string[]): void {
    Array.isArray(rawResponse) ? this.rawResponses.push(...rawResponse) : this.rawResponses.push(rawResponse);
  }

  public addCleanedResponse(cleanedResponse: string | string[]): void {
    Array.isArray(cleanedResponse)
      ? this.cleanedResponses.push(...cleanedResponse)
      : this.cleanedResponses.push(cleanedResponse);
  }

  public addYamlParseResult(yamlParseResult: string | string[]): void {
    Array.isArray(yamlParseResult)
      ? this.parseResults.push(...yamlParseResult)
      : this.parseResults.push(yamlParseResult);
  }

  public addPostGenDoc(postGenYaml: string): void {
    this.postGenDoc = postGenYaml;
  }

  public addFinalDoc(finalYaml: string): void {
    this.finalDoc = finalYaml;
  }

  public addDiagnostics(diagnostics: vscode.Diagnostic | vscode.Diagnostic[]): void {
    Array.isArray(diagnostics) ? this.diagnostics.push(...diagnostics) : this.diagnostics.push(diagnostics);
  }

  public async addSourceUnderStudy(uri: URI | URI[] | undefined): Promise<void> {
    if (this.okToLog() && uri) {
      try {
        if (Array.isArray(uri)) {
          // no-op
        } else {
          const fileContents = await vscode.workspace.fs.readFile(uri);
          this.sourceUnderStudy = Buffer.from(fileContents).toString('utf8');
        }
      } catch (error) {
        console.error(`Failed to read file(s) at ${uri.toString()}:`, error);
      }
    }
  }

  public addGenerationStrategy(strategy: string): void {
    this.generationStrategy = strategy;
  }

  public addGuidedJson(guidedJson: string): void {
    this.guidedJson = guidedJson;
  }

  public addOutputTokenLimit(tokenLimit: number): void {
    this.outputTokenLimit = tokenLimit;
  }

  public gatherAllFields(): Record<string, any> {
    return {
      sourceUnderStudy: this.sourceUnderStudy,
      generationStrategy: this.generationStrategy,
      outputTokenLimit: this.outputTokenLimit,
      guidedJson: this.guidedJson,
      prompts: this.prompts,
      rawResponses: this.rawResponses,
      cleanedResponses: this.cleanedResponses,
      parseResults: this.parseResults,
      postGenDoc: this.postGenDoc,
      finalDoc: this.finalDoc,
      diagnostics: this.diagnostics,
      apexClassOASEligibleRequest: this.apexClassOASEligibleRequest,
      apexClassOASEligibleResponse: this.apexClassOASEligibleResponse,
      apexClassOASGatherContextResponse: this.apexClassOASGatherContextResponse
    };
  }

  public writeLogs(): void {
    if (this.okToLog()) {
      // create a file path based on current date time
      const logPath = join(process.cwd(), 'llm-logs');
      const dateTime = new Date().toISOString().replace(/:/g, '-'); // colon is illegal for filename in Windows
      const fileName = `oas-gen-logs-${dateTime}.json`;
      const filePath = join(logPath, fileName);

      fs.mkdirSync(logPath, { recursive: true });
      // write to the file
      fs.writeFileSync(filePath, JSON.stringify(this.gatherAllFields(), undefined, 2), 'utf8');
    }
  }

  public clear(): void {
    this.apexClassOASEligibleRequest = [];
    this.apexClassOASEligibleResponse = [];
    this.apexClassOASGatherContextResponse = {};
    this.prompts = [];
    this.rawResponses = [];
    this.cleanedResponses = [];
    this.parseResults = [];
    this.diagnostics = [];
    this.postGenDoc = '';
    this.finalDoc = '';
    this.sourceUnderStudy = '';
    this.generationStrategy = '';
    this.guidedJson = '';
  }

  private okToLog(): boolean {
    return this.logLevel !== 'fatal';
  }
}
