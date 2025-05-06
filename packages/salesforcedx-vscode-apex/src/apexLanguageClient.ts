/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Uri } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';
import { ApexErrorHandler } from './apexErrorHandler';
import {
  ApexClassOASEligibleRequest,
  ApexClassOASEligibleResponse,
  ApexClassOASEligibleResponses,
  ApexClassOASGatherContextResponse,
  ApexOASEligiblePayload
} from './oas/schemas';

type ApexClassOASEligibleRequestForLSPProtocol = Omit<ApexClassOASEligibleRequest, 'resourceUri'> & {
  resourceUri: string;
};

type ApexOASEligiblePayloadForLSPProtocol = {
  payload: ApexClassOASEligibleRequestForLSPProtocol[];
};

type ApexClassOASEligibleResponseForLSPProtocol = Omit<ApexClassOASEligibleResponse, 'resourceUri'> & {
  resourceUri: string;
};

type ApexClassOASEligibleResponsesForLSPProtocol = ApexClassOASEligibleResponseForLSPProtocol[];

/**
 * ApexLanguageClient is a specialized LanguageClient for handling Apex-specific language server features.
 */
export class ApexLanguageClient extends LanguageClient {
  private _errorHandler: ApexErrorHandler | undefined;

  /**
   * Constructs an instance of ApexLanguageClient.
   * @param id - The ID of the language client.
   * @param name - The name of the language client.
   * @param serverOptions - The server options for the language client.
   * @param clientOptions - The client options for the language client.
   * @param forceDebug - Optional flag to force debug mode.
   */
  public constructor(
    id: string,
    name: string,
    serverOptions: ServerOptions,
    clientOptions: LanguageClientOptions,
    forceDebug?: boolean
  ) {
    super(id, name, serverOptions, clientOptions, forceDebug);
    this._errorHandler = clientOptions.errorHandler as ApexErrorHandler;
  }

  /**
   * Gets the error handler for the language client.
   * @returns The error handler.
   */
  public get errorHandler(): ApexErrorHandler | undefined {
    return this._errorHandler;
  }

  /**
   * Stops the language client.
   * @returns A promise that resolves when the client has stopped.
   */
  public async stop(): Promise<void> {
    await super.stop();
  }

  /**
   * Checks if the given requests are OpenAPI eligible.
   * @param requests - The requests to check.
   * @returns A promise that resolves with the eligibility responses or undefined.
   */
  public async isOpenAPIEligible(requests: ApexOASEligiblePayload): Promise<ApexClassOASEligibleResponses | undefined> {
    // given uris are embedded within a complex structure we must iterate over the collection and call code2ProtocolConverter for each uri
    const payload = requests.payload.map(req => {
      const requestUri = this.code2ProtocolConverter.asUri(req.resourceUri);
      return {
        ...req,
        resourceUri: requestUri
      };
    });

    const adjustedRequests: ApexOASEligiblePayloadForLSPProtocol = {
      payload
    };

    const results: ApexClassOASEligibleResponsesForLSPProtocol = await this.sendRequest(
      'apexoas/isEligible',
      adjustedRequests
    );

    return results.map(result => {
      const { resourceUri, ...adjustedResult } = result;

      return { ...adjustedResult, resourceUri: this.protocol2CodeConverter.asUri(resourceUri) };
    });
  }

  /**
   * Gathers OpenAPI context for the given source URI(s).
   * @param sourceUri - The source URI(s) to gather context for.
   * @returns A promise that resolves with the gathered context response(s).
   */
  public async gatherOpenAPIContext(sourceUri: Uri | Uri[]): Promise<ApexClassOASGatherContextResponse> {
    if (!Array.isArray(sourceUri)) {
      return this.sendRequest('apexoas/gatherContext', this.code2ProtocolConverter.asUri(sourceUri)).then(
        gatheredContext => gatheredContext as ApexClassOASGatherContextResponse
      );
    }
    throw new Error('Not implemented - Can only handle a single Uri for context gathering');
  }
}
