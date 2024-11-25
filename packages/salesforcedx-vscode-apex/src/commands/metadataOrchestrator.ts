/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { notificationService } from '@salesforce/salesforcedx-utils-vscode';
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
import { ServiceProvider, ServiceType, AiApiClient, CommandSource } from '@salesforce/vscode-service-provider';
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
   * Checks if a method is eligible for Apex Action creation.
   * @param methodIdentifier - The identifier of the method.
   * @returns True if the method is eligible, false otherwise.
   */
  public isMethodEligible = (methodIdentifier: string): boolean => {
    // Placeholder for eligibility logic
    return true;
  };

  /**
   * Extracts metadata for the method at the current cursor position.
   * @returns The metadata of the method, or undefined if no method is found.
   */
  public extractMetadata = async (
    sourceUri: vscode.Uri | undefined,
    isMethodSelected: boolean = false
  ): Promise<ApexClassOASEligibleResponse | undefined> => {
    const isEligibleResponses = await this.validateEligibility(sourceUri as vscode.Uri, isMethodSelected);
    const name = isEligibleResponses?.[0]?.symbols?.[0]?.docSymbol.name;

    if (!isEligibleResponses || !isEligibleResponses[0].isEligible) {
      throw new Error(nls.localize('not_aura_enabled', name));
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
        resourceUri: sourceUri?.path ?? vscode.window.activeTextEditor?.document.fileName!,
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
  sendPromptToLLM = async (editorText: string): Promise<string> => {
    console.log('This is the sendPromptToLLM() method');
    console.log('document text = ' + editorText);

    const systemPrompt = 'abc';

    const userPrompt =
      'Generate an OpenAPI v3 specification for my current Apex class. The OpenAPI v3 specification should be in YAML. The paths should be in the format of /{ClassName}/{MethodName} for the @AuraEnabled methods. When you return Id in a SOQL query, it has `type: Id`. For every `type: object`, generate a `#/components/schemas` entry for that object. The method should have a $ref entry pointing to the generated `#/components/schemas` entry. Only include methods that have the @AuraEnabled annotation in the paths of the OpenAPI v3 specification.';

    const systemTag = '<|system|>';
    const endOfPromptTag = '<|endofprompt|>';
    const userTag = '<|user|>';
    const assistantTag = '<|assistant|>';

    const input =
      `${systemTag}\n${systemPrompt}\n\n${endOfPromptTag}\n${userTag}\n` +
      userPrompt +
      `\n\n***Code Context***\n\`\`\`\n` +
      editorText +
      `\n\`\`\`\n${endOfPromptTag}\n${assistantTag}`;
    console.log('input = ' + input);
    let result;
    let documentContents;
    try {
      const apiClient = await this.getAiApiClient();
      result = await apiClient.naturalLanguageQuery({
        prefix: '',
        suffix: '',
        input: input,
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
