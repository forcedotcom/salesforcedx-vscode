/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ContinueResponse,
  LibraryCommandletExecutor
} from '@salesforce/salesforcedx-utils-vscode';
import {
  ComponentSet,
  DeployResult,
  MetadataApiDeploy,
  MetadataApiRetrieve,
  RetrieveResult
} from '@salesforce/source-deploy-retrieve';
import {
  RequestStatus
} from '@salesforce/source-deploy-retrieve/lib/src/client/types';
import * as vscode from 'vscode';
import { OUTPUT_CHANNEL } from '../channels';
import { TELEMETRY_METADATA_COUNT } from '../constants';
import { setApiVersionOn } from '../services/sdr/componentSetUtils';
import { createComponentCount, formatException } from './util';

type DeployRetrieveResult = DeployResult | RetrieveResult;
type DeployRetrieveOperation = MetadataApiDeploy | MetadataApiRetrieve;

export abstract class DeployRetrieveExecutor<
  T
> extends LibraryCommandletExecutor<T> {
  protected cancellable: boolean = true;

  constructor(executionName: string, logName: string) {
    super(executionName, logName, OUTPUT_CHANNEL);
  }

  public async run(
    response: ContinueResponse<T>,
    progress?: vscode.Progress<{
      message?: string | undefined;
      increment?: number | undefined;
    }>,
    token?: vscode.CancellationToken
  ): Promise<boolean> {
    let result: DeployRetrieveResult | undefined;

    try {
      const components = await this.getComponents(response);
      await setApiVersionOn(components);

      this.telemetry.addProperty(
        TELEMETRY_METADATA_COUNT,
        JSON.stringify(createComponentCount(components))
      );

      result = await this.doOperation(components, token);

      const status = result?.response.status;

      return (
        status === RequestStatus.Succeeded ||
        status === RequestStatus.SucceededPartial
      );
    } catch (e) {
      throw formatException(e);
    } finally {
      await this.postOperation(result);
    }
  }

  protected setupCancellation(
    operation: DeployRetrieveOperation | undefined,
    token?: vscode.CancellationToken
  ) {
    if (token && operation) {
      token.onCancellationRequested(async () => {
        await operation.cancel();
      });
    }
  }

  protected abstract getComponents(
    response: ContinueResponse<T>
  ): Promise<ComponentSet>;
  protected abstract doOperation(
    components: ComponentSet,
    token?: vscode.CancellationToken
  ): Promise<DeployRetrieveResult | undefined>;
  protected abstract postOperation(
    result: DeployRetrieveResult | undefined
  ): Promise<void>;
}

