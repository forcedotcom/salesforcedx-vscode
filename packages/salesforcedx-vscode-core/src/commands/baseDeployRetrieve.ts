/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ConfigUtil,
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
import { RequestStatus } from '@salesforce/source-deploy-retrieve/lib/src/client/types';
import * as vscode from 'vscode';
import { OUTPUT_CHANNEL } from '../channels';
import { TELEMETRY_METADATA_COUNT } from '../constants';
import { OrgAuthInfo } from '../util';
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
      const componentSet = await this.getComponents(response);
      await this.setApiVersionOn(componentSet);

      const componentCount = createComponentCount(componentSet);
      this.telemetry.addProperty(
        TELEMETRY_METADATA_COUNT,
        JSON.stringify(componentCount)
      );

      result = await this.doOperation(componentSet, token);

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

  private async setApiVersionOn(components: ComponentSet) {
    // Check the SFDX configuration to see if there is an overridden api version.
    // Project level local sfdx-config takes precedence over global sfdx-config at system level.
    const userConfiguredApiVersion:
      | string
      | undefined = await ConfigUtil.getUserConfiguredApiVersion();

    if (userConfiguredApiVersion) {
      components.apiVersion = userConfiguredApiVersion;
      return;
    }

    // If no user-configured Api Version is present, then get the version from the Org.
    const orgApiVersion = await OrgAuthInfo.getOrgApiVersion();
    components.apiVersion = orgApiVersion ?? components.apiVersion;
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
