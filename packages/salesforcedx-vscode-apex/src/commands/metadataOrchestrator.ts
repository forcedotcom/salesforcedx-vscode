/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AiApiClient, CommandSource, ServiceProvider, ServiceType } from '@salesforce/vscode-service-provider';
import path from 'path';
import * as vscode from 'vscode';
import { languageClientUtils } from '../languageUtils';
import { nls } from '../messages';
import {
  ApexClassOASEligibleRequest,
  ApexClassOASEligibleResponse,
  ApexClassOASEligibleResponses,
  ApexOASEligiblePayload,
  ApexOASResource
} from '../openApiUtilities/schemas';
import { getTelemetryService } from '../telemetry/telemetry';

/**
 * Interface representing the metadata of a method.
 */
export interface MethodMetadata {
  name: string;
  parameters: Parameter[];
  returnType: string;
  isAuraEnabled: boolean;
  className?: string;
}

/**
 * Interface representing a parameter of a method.
 */
export interface Parameter {
  name: string;
  in: string;
  required: boolean;
  description: string;
  schema: { type: string };
}

/**
 * Class responsible for orchestrating metadata operations.
 */
export class MetadataOrchestrator {
  /**
   * Extracts metadata for the method at the current cursor position.
   * @returns The metadata of the method, or undefined if no method is found.
   */
  public extractMetadata = async (
    sourceUri: vscode.Uri | vscode.Uri[],
    isMethodSelected: boolean = false
  ): Promise<ApexClassOASEligibleResponse | undefined> => {
    const isEligibleResponses = await this.validateEligibility(sourceUri, isMethodSelected);
    if (!isEligibleResponses || isEligibleResponses.length === 0) {
      throw new Error('Failed to validate metadata.');
    }
    if (!isEligibleResponses[0].isEligible) {
      if (isMethodSelected) {
        const name = isEligibleResponses?.[0]?.symbols?.[0]?.docSymbol.name;
        throw new Error(nls.localize('not_aura_enabled', name));
      }
      throw new Error(
        nls.localize(
          `The Apex Class ${path.basename(isEligibleResponses[0].resourceUri, '.cls')} is not valid for Open AI document generation.`
        )
      );
    }
    return isEligibleResponses[0];
  };

  public eligibilityDelegate = async (
    requests: ApexOASEligiblePayload
  ): Promise<ApexClassOASEligibleResponses | undefined> => {
    const telemetryService = await getTelemetryService();
    let response;
    const languageClient = languageClientUtils.getClientInstance();
    if (languageClient) {
      const classNumbers = requests.payload.length.toString();
      const requestTarget = this.requestTarget(requests);
      try {
        response = (await languageClient?.sendRequest('apexoas/isEligible', requests)) as ApexClassOASEligibleResponses;
        telemetryService.sendEventData('isEligibleResponseSucceeded', {
          classNumbers,
          requestTarget
        });
      } catch (error) {
        telemetryService.sendException(
          'isEligibleResponseFailed',
          `${error} failed to send request to language server with ${classNumbers} classes and target of request for ${requestTarget}`
        );
        // fallback TBD after we understand it better
        throw new Error(nls.localize('cannot_get_apexoaseligibility_response'));
      }
    }
    return response;
  };

  public validateEligibility = async (
    sourceUri: vscode.Uri | vscode.Uri[],
    isMethodSelected: boolean = false
  ): Promise<ApexClassOASEligibleResponses | undefined> => {
    const telemetryService = await getTelemetryService();
    const requests = [];
    if (Array.isArray(sourceUri)) {
      // if sourceUri is an array, then multiple classes/folders are selected
      for (const uri of sourceUri) {
        const request = {
          resourceUri: uri.path,
          includeAllMethods: true,
          includeAllProperties: true,
          methodNames: [],
          positions: null,
          propertyNames: []
        } as ApexClassOASEligibleRequest;
        requests.push(request);
      }
    } else {
      let cursorPosition;
      if (isMethodSelected) {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.fileName.endsWith('cls')) {
          cursorPosition = editor.selection.active;
        } else {
          telemetryService.sendException('activeTextEditorNotApex', nls.localize('active_text_editor_not_apex'));
          throw new Error(nls.localize('invalid_active_text_editor'));
        }
      }
      // generate the payload
      const request: ApexClassOASEligibleRequest = {
        resourceUri: sourceUri ? sourceUri.toString() : vscode.window.activeTextEditor?.document.uri.toString() || '',
        includeAllMethods: !isMethodSelected,
        includeAllProperties: !isMethodSelected,
        positions: cursorPosition ? [cursorPosition] : null,
        methodNames: [],
        propertyNames: []
      };
      requests.push(request);
    }

    const responses = await this.eligibilityDelegate({ payload: requests });
    return responses;
  };

  public requestTarget(requestPayload: ApexOASEligiblePayload): ApexOASResource {
    const payload = requestPayload.payload;
    if (payload.length > 1) return ApexOASResource.multiClass;
    else {
      const request = payload[0];
      if (!request.includeAllMethods && !request.includeAllProperties) return ApexOASResource.singleMethodOrProp;
      if (!request.resourceUri.endsWith('.cls')) {
        return ApexOASResource.folder;
      } else return ApexOASResource.class;
    }
  }
  sendPromptToLLM = async (editorText: string, methods: string[], className: string): Promise<string> => {
    console.log('This is the sendPromptToLLM() method');
    console.log('document text = ' + editorText);

    const systemPrompt = 'abc';

    const userPrompt =
      'Generate an OpenAPI v3 specification for the following Apex class. The OpenAPI v3 specification should be a YAML file. The paths should be in the format of /{ClassName}/{MethodName} for all the @AuraEnabled methods specified. When you return Id in a SOQL query, it has `type: Id`. For every `type: object`, generate a `#/components/schemas` entry for that object. The method should have a $ref entry pointing to the generated `#/components/schemas` entry. Only include methods that have the @AuraEnabled annotation in the paths of the OpenAPI v3 specification. I do not want AUTHOR_PLACEHOLDER in the result.';

    const systemTag = '<|system|>';
    const endOfPromptTag = '<|endofprompt|>';
    const userTag = '<|user|>';
    const assistantTag = '<|assistant|>';

    const input =
      `${systemTag}\n${systemPrompt}\n\n${endOfPromptTag}\n${userTag}\n` +
      userPrompt +
      '\n\n***Code Context***\n```\n' +
      editorText +
      `\nClass name: ${className}, methods: ${methods.join(',')}\n` +
      `\n\`\`\`\n${endOfPromptTag}\n${assistantTag}`;
    console.log('input = ' + input);
    let result;
    let documentContents;
    try {
      const apiClient = await this.getAiApiClient();
      result = await apiClient.naturalLanguageQuery({
        prefix: '',
        suffix: '',
        input,
        commandSource: CommandSource.NLtoCodeGen,
        promptId: 'generateOpenAPIv3Specifications'
      });
      documentContents = result[0].completion;
      if (documentContents.includes('try again')) throw new Error(documentContents);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(errorMessage);
    }

    return documentContents;
  };

  getAiApiClient = async (): Promise<AiApiClient> => {
    return ServiceProvider.getService(ServiceType.AiApiClient);
  };
}
