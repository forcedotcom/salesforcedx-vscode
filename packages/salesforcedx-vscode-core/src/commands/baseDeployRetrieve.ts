/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ConfigUtil,
  ContinueResponse,
  getRelativeProjectPath,
  getRootWorkspacePath,
  LibraryCommandletExecutor,
  Row,
  Table
} from '@salesforce/salesforcedx-utils-vscode';
import {
  ComponentSet,
  DeployResult,
  MetadataApiDeploy,
  MetadataApiRetrieve,
  MetadataComponent,
  RetrieveResult
} from '@salesforce/source-deploy-retrieve';
import {
  ComponentStatus,
  RequestStatus
} from '@salesforce/source-deploy-retrieve/lib/src/client/types';
import { join } from 'path';
import * as vscode from 'vscode';
import { channelService, OUTPUT_CHANNEL } from '../channels';
import { PersistentStorageService } from '../conflict/persistentStorageService';
import { TELEMETRY_METADATA_COUNT } from '../constants';
import { WorkspaceContext } from '../context/workspaceContext';
import { nls } from '../messages';
import { SourceTrackingService } from '../services';
import { SfdxPackageDirectories } from '../sfdxProject';
import { OrgAuthInfo } from '../util';
import { createComponentCount, formatException } from './util';

type DeployRetrieveResult = DeployResult | RetrieveResult;
type DeployRetrieveOperation = MetadataApiDeploy | MetadataApiRetrieve;

export abstract class DeployRetrieveExecutor<
  T
> extends LibraryCommandletExecutor<T> {
  protected cancellable: boolean = true;
  protected sourceTrackingService = new SourceTrackingService();

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

      const d: Iterable<MetadataComponent> = componentSet.getSourceComponents();
      const componentCount = createComponentCount(d);
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

export abstract class RetrieveExecutor<T> extends DeployRetrieveExecutor<T> {
  protected async doOperation(
    components: ComponentSet,
    token: vscode.CancellationToken
  ): Promise<RetrieveResult | undefined> {
    const connection = await WorkspaceContext.getInstance().getConnection();

    const defaultOutput = join(
      getRootWorkspacePath(),
      (await SfdxPackageDirectories.getDefaultPackageDir()) ?? ''
    );

    const sourceTracking = await SourceTrackingService.createSourceTracking();
    const operation = await components.retrieve({
      usernameOrConnection: connection,
      output: defaultOutput,
      merge: true
    });

    this.setupCancellation(operation, token);

    return operation.pollStatus();
  }

  protected async postOperation(
    result: RetrieveResult | undefined
  ): Promise<void> {
    if (result) {
      const relativePackageDirs = await SfdxPackageDirectories.getPackageDirectoryPaths();
      const output = this.createOutput(result, relativePackageDirs);
      channelService.appendLine(output);
      PersistentStorageService.getInstance().setPropertiesForFilesRetrieve(
        result.response.fileProperties
      );
    }
  }

  private createOutput(
    result: RetrieveResult,
    relativePackageDirs: string[]
  ): string {
    const successes: Row[] = [];
    const failures: Row[] = [];

    for (const response of result.getFileResponses()) {
      const asRow = (response as unknown) as Row;
      response.filePath = getRelativeProjectPath(
        response.filePath,
        relativePackageDirs
      );
      if (response.state !== ComponentStatus.Failed) {
        successes.push(asRow);
      } else {
        failures.push(asRow);
      }
    }

    return this.createOutputTable(successes, failures);
  }

  private createOutputTable(successes: Row[], failures: Row[]): string {
    const table = new Table();

    let output = '';

    if (successes.length > 0) {
      output += table.createTable(
        successes,
        [
          { key: 'fullName', label: nls.localize('table_header_full_name') },
          { key: 'type', label: nls.localize('table_header_type') },
          {
            key: 'filePath',
            label: nls.localize('table_header_project_path')
          }
        ],
        nls.localize(`lib_retrieve_result_title`)
      );
    }

    if (failures.length > 0) {
      if (successes.length > 0) {
        output += '\n';
      }
      output += table.createTable(
        failures,
        [
          { key: 'fullName', label: nls.localize('table_header_full_name') },
          { key: 'type', label: nls.localize('table_header_type') },
          { key: 'error', label: nls.localize('table_header_message') }
        ],
        nls.localize('lib_retrieve_message_title')
      );
    }

    return output;
  }
}
