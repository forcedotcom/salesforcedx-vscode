/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LLMServiceInterface, ServiceProvider, ServiceType } from '@salesforce/vscode-service-provider';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { languageClientManager } from '../languageUtils';
import { nls } from '../messages';
import GenerationInteractionLogger from '../oas/generationInteractionLogger';
import {
  ApexClassOASEligibleRequest,
  ApexClassOASEligibleResponse,
  ApexClassOASEligibleResponses,
  ApexClassOASGatherContextResponse,
  ApexOASEligiblePayload,
  ApexOASResource
} from '../oas/schemas';
import { getTelemetryService } from '../telemetry/telemetry';

const gil = GenerationInteractionLogger.getInstance();

/**
 * Class responsible for orchestrating metadata operations.
 */
export class MetadataOrchestrator {
  /**
   * Validates and extracts metadata for the method at the current cursor position.
   * @returns The metadata of the method, or undefined if no method is found.
   */
  public validateMetadata = async (
    sourceUri: URI | URI[],
    isMethodSelected: boolean = false
  ): Promise<ApexClassOASEligibleResponse | undefined> => {
    const isEligibleResponses = await this.validateEligibility(sourceUri, isMethodSelected);
    gil.addApexClassOASEligibleResponse(isEligibleResponses);
    if (!isEligibleResponses || isEligibleResponses.length === 0) {
      throw new Error(nls.localize('validation_failed'));
    }
    if (!isEligibleResponses[0].isApexOasEligible && !isEligibleResponses[0].isEligible) {
      throw new Error(
        nls.localize(
          'apex_class_not_valid',
          isEligibleResponses[0].resourceUri?.fsPath
            ? path.basename(isEligibleResponses[0].resourceUri.fsPath, '.cls')
            : 'unknown'
        )
      );
    }
    const symbols = isEligibleResponses[0].symbols ?? [];
    const eligibleSymbols = symbols.filter(s => s.isApexOasEligible || s.isEligible);
    if (eligibleSymbols.length === 0) {
      throw new Error(
        nls.localize('apex_class_not_valid', path.basename(isEligibleResponses[0].resourceUri.fsPath, '.cls'))
      );
    }
    return isEligibleResponses[0];
  };

  public eligibilityDelegate = async (
    requests: ApexOASEligiblePayload
  ): Promise<ApexClassOASEligibleResponses | undefined> => {
    gil.addApexClassOASEligibleRequest(requests.payload);
    const telemetryService = await getTelemetryService();
    const languageClient = languageClientManager.getClientInstance();
    if (languageClient) {
      const classNumbers = requests.payload.length.toString();
      const requestTarget = buildRequestTarget(requests);
      try {
        const response = await languageClient?.isOpenAPIEligible(requests);
        telemetryService.sendEventData('isEligibleResponseSucceeded', {
          classNumbers,
          requestTarget
        });
        return response;
      } catch (error) {
        telemetryService.sendException(
          'isEligibleResponseFailed',
          `${error} failed to send request to language server with ${classNumbers} classes and target of request for ${requestTarget}`
        );
        throw new Error(nls.localize('cannot_get_apexoaseligibility_response'));
      }
    }
  };

  public gatherContext = async (sourceUri: URI | URI[]): Promise<ApexClassOASGatherContextResponse | undefined> => {
    const telemetryService = await getTelemetryService();
    let response: ApexClassOASGatherContextResponse | undefined;
    const languageClient = languageClientManager.getClientInstance();
    if (languageClient) {
      try {
        response = await languageClient?.gatherOpenAPIContext(
          sourceUri ?? vscode.window.activeTextEditor?.document.uri
        );
        telemetryService.sendEventData('gatherContextSucceeded', { context: JSON.stringify(response) });
      } catch (error) {
        telemetryService.sendException(
          'gatherContextFailed',
          `${error} failed to send request to language server for ${path.basename(sourceUri.toString())}`
        );
        throw new Error(nls.localize('cannot_gather_context'));
      }
    }
    gil.addApexClassOASGatherContextResponse(response);
    return response;
  };

  public validateEligibility = async (
    sourceUri: URI | URI[],
    isMethodSelected: boolean = false
  ): Promise<ApexClassOASEligibleResponses | undefined> => {
    const telemetryService = await getTelemetryService();
    const requests = [];
    if (Array.isArray(sourceUri)) {
      await gil.addSourceUnderStudy(sourceUri);
      for (const uri of sourceUri) {
        const request: ApexClassOASEligibleRequest = {
          resourceUri: uri,
          includeAllMethods: true,
          includeAllProperties: true,
          methodNames: [],
          position: null,
          propertyNames: []
        };
        requests.push(request);
      }
    } else {
      let cursorPosition;
      if (isMethodSelected) {
        const editor = vscode.window.activeTextEditor;
        if (editor?.document.fileName.endsWith('.cls')) {
          cursorPosition = editor.selection.active;
        } else {
          telemetryService.sendException('activeTextEditorNotApex', nls.localize('active_text_editor_not_apex'));
          throw new Error(nls.localize('invalid_active_text_editor'));
        }
      }
      await gil.addSourceUnderStudy(sourceUri ? sourceUri : vscode.window.activeTextEditor?.document.uri);
      const resourceUri = sourceUri ?? vscode.window.activeTextEditor?.document.uri;
      if (!resourceUri) {
        throw new Error(
          'Cannot resolve URI for OAS Generation request. Please ensure that the location used to launch the command is from a file, folder or active editor'
        );
      }
      const request: ApexClassOASEligibleRequest = {
        resourceUri,
        includeAllMethods: !isMethodSelected,
        includeAllProperties: !isMethodSelected,
        position: cursorPosition ?? null,
        methodNames: [],
        propertyNames: []
      };
      requests.push(request);
    }

    const responses = await this.eligibilityDelegate({ payload: requests });
    return responses;
  };

  getLLMServiceInterface = async (): Promise<LLMServiceInterface> =>
    ServiceProvider.getService(ServiceType.LLMService, 'salesforcedx-vscode-apex');
}

export const buildRequestTarget = (requestPayload: ApexOASEligiblePayload): ApexOASResource => {
  const payload = requestPayload.payload;
  if (payload.length > 1) return ApexOASResource.multiClass;
  else {
    const request = payload[0];
    if (!request.includeAllMethods && !request.includeAllProperties) return ApexOASResource.singleMethodOrProp;
    if (!request.resourceUri?.fsPath.endsWith('.cls')) {
      return ApexOASResource.folder;
    } else return ApexOASResource.class;
  }
};
