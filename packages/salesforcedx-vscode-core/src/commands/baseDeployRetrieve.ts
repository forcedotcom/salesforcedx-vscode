/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ContinueResponse,
  getRelativeProjectPath,
  getRootWorkspacePath,
  LibraryCommandletExecutor,
  Row,
  SourceTrackingService,
  SourceTrackingType,
  Table
} from '@salesforce/salesforcedx-utils-vscode';
import {
  ComponentSet,
  DeployResult,
  MetadataApiDeploy,
  MetadataApiRetrieve,
  RetrieveResult
} from '@salesforce/source-deploy-retrieve-bundle';
import { ComponentStatus, RequestStatus } from '@salesforce/source-deploy-retrieve-bundle/lib/src/client/types';
import { join } from 'path';
import * as vscode from 'vscode';
import { channelService, OUTPUT_CHANNEL } from '../channels';
import { PersistentStorageService } from '../conflict/persistentStorageService';
import { TELEMETRY_METADATA_COUNT } from '../constants';
import { WorkspaceContext, workspaceContextUtils } from '../context';
import { handleDeployDiagnostics } from '../diagnostics';
import { nls } from '../messages';
import { SalesforcePackageDirectories } from '../salesforceProject';
import { componentSetUtils } from '../services/sdr/componentSetUtils';
import { DeployQueue, salesforceCoreSettings } from '../settings';
import { createComponentCount, formatException, SfCommandletExecutor } from './util';

type DeployRetrieveResult = DeployResult | RetrieveResult;
type DeployRetrieveOperation = MetadataApiDeploy | MetadataApiRetrieve;

export abstract class DeployRetrieveExecutor<T> extends LibraryCommandletExecutor<T> {
  public static errorCollection = vscode.languages.createDiagnosticCollection('deploy-errors');
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
      await componentSetUtils.setApiVersion(components);
      await componentSetUtils.setSourceApiVersion(components);

      this.telemetry.addProperty(TELEMETRY_METADATA_COUNT, JSON.stringify(createComponentCount(components)));

      result = await this.doOperation(components, token);

      const status = result?.response.status;

      return status === RequestStatus.Succeeded || status === RequestStatus.SucceededPartial;
    } catch (e) {
      throw formatException(e);
    } finally {
      await this.postOperation(result);
    }
  }

  protected setupCancellation(operation: DeployRetrieveOperation | undefined, token?: vscode.CancellationToken) {
    if (token && operation) {
      token.onCancellationRequested(async () => {
        await operation.cancel();
      });
    }
  }

  protected abstract getComponents(response: ContinueResponse<T>): Promise<ComponentSet>;
  protected abstract doOperation(
    components: ComponentSet,
    token?: vscode.CancellationToken
  ): Promise<DeployRetrieveResult | undefined>;
  protected abstract postOperation(result: DeployRetrieveResult | undefined): Promise<void>;
}

export abstract class DeployExecutor<T> extends DeployRetrieveExecutor<T> {
  protected async doOperation(
    components: ComponentSet,
    token: vscode.CancellationToken
  ): Promise<DeployResult | undefined> {
    const projectPath = getRootWorkspacePath();
    const connection = await WorkspaceContext.getInstance().getConnection();
    components.projectDirectory = projectPath;
    const sourceTrackingEnabled = salesforceCoreSettings.getEnableSourceTrackingForDeployAndRetrieve();
    if (sourceTrackingEnabled) {
      const sourceTracking = await SourceTrackingService.getSourceTracking(projectPath, connection);
      await sourceTracking.ensureLocalTracking();
    }

    const operation = await components.deploy({
      usernameOrConnection: connection
    });

    this.setupCancellation(operation, token);

    return operation.pollStatus();
  }

  protected async postOperation(result: DeployResult | undefined): Promise<void> {
    try {
      if (result) {
        // Update Persistent Storage for the files that were deployed
        PersistentStorageService.getInstance().setPropertiesForFilesDeploy(result);

        const relativePackageDirs = await SalesforcePackageDirectories.getPackageDirectoryPaths();
        const output = this.createOutput(result, relativePackageDirs);
        channelService.appendLine(output);

        const success = result.response.status === RequestStatus.Succeeded;
        if (!success) {
          this.unsuccessfulOperationHandler(result, DeployRetrieveExecutor.errorCollection);
        } else {
          DeployRetrieveExecutor.errorCollection.clear();
          SfCommandletExecutor.errorCollection.clear();
        }
      }
    } finally {
      await DeployQueue.get().unlock();
    }
  }

  protected unsuccessfulOperationHandler(result: DeployResult, errorCollection: any) {
    handleDeployDiagnostics(result, errorCollection);
  }

  private createOutput(result: DeployResult, relativePackageDirs: string[]): string {
    const table = new Table();

    const rowsWithRelativePaths = result.getFileResponses().map(response => {
      response.filePath = getRelativeProjectPath(response.filePath, relativePackageDirs);
      return response;
    }) as unknown as Row[];

    let output: string;

    if (result.response.status === RequestStatus.Succeeded) {
      output = table.createTable(
        rowsWithRelativePaths,
        [
          { key: 'state', label: nls.localize('table_header_state') },
          { key: 'fullName', label: nls.localize('table_header_full_name') },
          { key: 'type', label: nls.localize('table_header_type') },
          {
            key: 'filePath',
            label: nls.localize('table_header_project_path')
          }
        ],
        nls.localize('table_title_deployed_source')
      );
    } else {
      output = table.createTable(
        rowsWithRelativePaths.filter(row => row.error),
        [
          {
            key: 'filePath',
            label: nls.localize('table_header_project_path')
          },
          { key: 'error', label: nls.localize('table_header_errors') }
        ],
        nls.localize('table_title_deploy_errors')
      );
    }

    return output;
  }
}

export abstract class RetrieveExecutor<T> extends DeployRetrieveExecutor<T> {
  private sourceTracking?: SourceTrackingType;

  protected async doOperation(
    components: ComponentSet,
    token: vscode.CancellationToken
  ): Promise<RetrieveResult | undefined> {
    const projectPath = getRootWorkspacePath();
    const connection = await WorkspaceContext.getInstance().getConnection();
    const sourceTrackingEnabled = salesforceCoreSettings.getEnableSourceTrackingForDeployAndRetrieve();
    if (sourceTrackingEnabled) {
      const orgType = await workspaceContextUtils.getWorkspaceOrgType();
      if (orgType === workspaceContextUtils.OrgType.SourceTracked) {
        this.sourceTracking = await SourceTrackingService.getSourceTracking(projectPath, connection);
      }
    }

    const defaultOutput = join(projectPath, (await SalesforcePackageDirectories.getDefaultPackageDir()) ?? '');

    const operation = await components.retrieve({
      usernameOrConnection: connection,
      output: defaultOutput,
      merge: true,
      suppressEvents: false
    });

    this.setupCancellation(operation, token);

    const result: RetrieveResult = await operation.pollStatus();
    if (sourceTrackingEnabled) {
      const status = result?.response?.status;
      if ((status === RequestStatus.Succeeded || status === RequestStatus.SucceededPartial) && this.sourceTracking) {
        await SourceTrackingService.updateSourceTrackingAfterRetrieve(this.sourceTracking, result);
      }
    }

    return result;
  }

  protected async postOperation(result: RetrieveResult | undefined): Promise<void> {
    if (result) {
      DeployRetrieveExecutor.errorCollection.clear();
      SfCommandletExecutor.errorCollection.clear();
      const relativePackageDirs = await SalesforcePackageDirectories.getPackageDirectoryPaths();
      const output = this.createOutput(result, relativePackageDirs);
      channelService.appendLine(output);
      if (result?.response?.fileProperties !== undefined) {
        PersistentStorageService.getInstance().setPropertiesForFilesRetrieve(result.response.fileProperties);
      }
    }
  }

  private createOutput(result: RetrieveResult, relativePackageDirs: string[]): string {
    const successes: Row[] = [];
    const failures: Row[] = [];

    for (const response of result.getFileResponses()) {
      const asRow = response as unknown as Row;
      response.filePath = getRelativeProjectPath(response.filePath, relativePackageDirs);
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
        nls.localize('lib_retrieve_result_title')
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
