/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as vscode from 'vscode';
import { ApexClassOASEligibleRequest } from './schemas';

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

  private constructor() {}

  public static getInstance(): GenerationInteractionLogger {
    if (!GenerationInteractionLogger.instance) {
      GenerationInteractionLogger.instance = new GenerationInteractionLogger();
      const config = vscode.workspace.getConfiguration();
      GenerationInteractionLogger.instance.logLevel = config.get('salesforcedx-vscode-core.SF_LOG_LEVEL', 'fatal');
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
    if (Array.isArray(prompt)) {
      this.prompts.push(...prompt);
    } else {
      this.prompts.push(prompt);
    }
  }

  public addRawResponse(rawResponse: string | string[]): void {
    if (Array.isArray(rawResponse)) {
      this.rawResponses.push(...rawResponse);
    } else {
      this.rawResponses.push(rawResponse);
    }
  }

  public addCleanedResponse(cleanedResponse: string | string[]): void {
    if (Array.isArray(cleanedResponse)) {
      this.cleanedResponses.push(...cleanedResponse);
    } else {
      this.cleanedResponses.push(cleanedResponse);
    }
  }

  public addYamlParseResult(yamlParseResult: string | string[]): void {
    if (Array.isArray(yamlParseResult)) {
      this.parseResults.push(...yamlParseResult);
    } else {
      this.parseResults.push(yamlParseResult);
    }
  }

  public addPostGenDoc(postGenYaml: string): void {
    this.postGenDoc = postGenYaml;
  }

  public addFinalDoc(finalYaml: string): void {
    this.finalDoc = finalYaml;
  }

  public addDiagnostics(diagnostics: vscode.Diagnostic | vscode.Diagnostic[]): void {
    if (Array.isArray(diagnostics)) {
      this.diagnostics.push(...diagnostics);
    } else {
      this.diagnostics.push(diagnostics);
    }
  }

  public async addSourceUnderStudy(uri: vscode.Uri | vscode.Uri[] | undefined): Promise<void> {
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

  public gatherAllFields(): Record<string, any> {
    return {
      sourceUnderStudy: this.sourceUnderStudy,
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
      const logPath = `${process.cwd()}/llm-logs`;
      const dateTime = new Date().toISOString();
      const fileName = `oas-gen-logs-${dateTime}.json`;
      const filePath = `${logPath}/${fileName}`;

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
  }

  private okToLog(): boolean {
    return this.logLevel !== 'fatal';
  }
}
