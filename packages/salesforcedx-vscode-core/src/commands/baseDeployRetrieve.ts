/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ContinueResponse,
  LibraryCommandletExecutor,
  getRelativeProjectPath,
  Row,
  Table,
  workspaceUtils,
  SourceTrackingService
} from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet, MetadataApiDeploy, MetadataApiRetrieve } from '@salesforce/source-deploy-retrieve-bundle';
import {
  ComponentStatus,
  FileResponse,
  FileResponseFailure,
  MetadataTransferResult,
  RequestStatus
} from '@salesforce/source-deploy-retrieve-bundle/lib/src/client/types';
import * as nodePath from 'node:path';
import * as vscode from 'vscode';
import { channelService, OUTPUT_CHANNEL } from '../channels';
import { TELEMETRY_METADATA_COUNT } from '../constants';
import { WorkspaceContext } from '../context/workspaceContext';
import { nls } from '../messages';
import { componentSetUtils } from '../services/sdr/componentSetUtils';
import { salesforceCoreSettings } from '../settings';
import { createComponentCount, formatException } from './util';
import { SfCommandletExecutor } from './util/sfCommandletExecutor';

export abstract class DeployRetrieveExecutor<T, R extends MetadataTransferResult> extends LibraryCommandletExecutor<T> {
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
    let result: R | undefined;

    try {
      const components = await this.getComponents(response);
      await componentSetUtils.setApiVersion(components);
      await componentSetUtils.setSourceApiVersion(components);

      this.telemetry.addProperty(TELEMETRY_METADATA_COUNT, JSON.stringify(createComponentCount(components)));

      result = await this.doOperation(components, token);

      // If result is undefined, it means no components were processed (empty ComponentSet)
      // This is considered a successful operation since there's nothing to do
      if (result === undefined) {
        return true;
      }

      const status = result?.response.status;

      return status === RequestStatus.Succeeded || status === RequestStatus.SucceededPartial;
    } catch (e) {
      throw formatException(e);
    } finally {
      await this.postOperation(result);
    }
  }

  protected setupCancellation(
    operation: MetadataApiDeploy | MetadataApiRetrieve | undefined,
    token?: vscode.CancellationToken
  ) {
    if (token && operation) {
      token.onCancellationRequested(async () => {
        await operation.cancel();
      });
    }
  }

  protected abstract getComponents(response: ContinueResponse<T>): Promise<ComponentSet>;
  protected abstract doOperation(components: ComponentSet, token?: vscode.CancellationToken): Promise<R | undefined>;
  protected abstract postOperation(result: R | undefined): Promise<void>;

  protected isPushOperation(): boolean {
    return false; // Default to deploy operation
  }

  protected isPullOperation(): boolean {
    return false; // Default to retrieve operation
  }

  /**
   * Shared method to perform the actual operation (deploy or retrieve)
   * This eliminates duplication between performDeployment and performRetrieve methods
   * @param components The ComponentSet to operate on
   * @param token Cancellation token
   * @returns Promise<boolean> True if operation succeeded, false otherwise
   */
  protected async performOperation(components: ComponentSet, token?: vscode.CancellationToken): Promise<boolean> {
    let result: R | undefined;

    try {
      // Set API versions
      await componentSetUtils.setApiVersion(components);
      await componentSetUtils.setSourceApiVersion(components);

      // Add telemetry
      this.telemetry.addProperty(TELEMETRY_METADATA_COUNT, JSON.stringify(createComponentCount(components)));

      // Perform the operation
      result = await this.doOperation(components, token ?? new vscode.CancellationTokenSource().token);

      // If result is undefined, it means no components were processed (empty ComponentSet)
      // This is considered a successful operation since there's nothing to do
      if (result === undefined) {
        return true;
      }

      const status = result?.response.status;

      return status === RequestStatus.Succeeded || status === RequestStatus.SucceededPartial;
    } catch (e) {
      throw formatException(e);
    } finally {
      await this.postOperation(result);
    }
  }

  /**
   * Shared method to handle empty ComponentSet scenarios
   * This eliminates duplication between deploy and retrieve executors
   * @param operationType The type of operation ('push' | 'deploy' | 'pull' | 'retrieve')
   * @param isSuccess Whether the operation was successful
   */
  protected handleEmptyComponentSet(operationType: OperationType, isSuccess: boolean = true): void {
    const output =
      operationType === 'push' || operationType === 'deploy'
        ? createDeployOrPushOutput([], [], isSuccess, operationType)
        : createRetrieveOrPullOutput([], [], operationType);

    channelService.appendLine(output);

    // Clear any existing errors since this is a successful "no changes" scenario
    DeployRetrieveExecutor.errorCollection.clear();
    SfCommandletExecutor.errorCollection.clear();
  }

  /**
   * Shared method to setup source tracking and populate changed file paths
   * This eliminates duplication between projectDeployStart and projectRetrieveStart
   * @param changedFilePaths Array to populate with changed file paths
   * @returns Promise<ComponentSet> The local component set for further processing
   */
  protected async setupSourceTrackingAndChangedFilePaths(changedFilePaths: string[]): Promise<ComponentSet> {
    const projectPath = workspaceUtils.getRootWorkspacePath() ?? '';
    const sourceTrackingEnabled = salesforceCoreSettings.getEnableSourceTrackingForDeployAndRetrieve();

    if (sourceTrackingEnabled) {
      try {
        const connection = await WorkspaceContext.getInstance().getConnection();
        if (!connection) {
          throw new Error(nls.localize('error_source_tracking_connection_failed'));
        }

        const sourceTracking = await SourceTrackingService.getSourceTracking(projectPath, connection);
        if (!sourceTracking) {
          throw new Error(nls.localize('error_source_tracking_service_failed'));
        }

        // Get local changes for conflict detection using the proper method
        const localComponentSets = await sourceTracking.localChangesAsComponentSet(false);
        const localComponentSet = localComponentSets.length > 0 ? localComponentSets[0] : new ComponentSet();

        // Populate changedFilePaths for conflict detection from local changes
        changedFilePaths.length = 0; // Clear the array
        for (const component of localComponentSet.getSourceComponents()) {
          if (component.content) {
            const filePath = nodePath.isAbsolute(component.content)
              ? component.content
              : nodePath.resolve(projectPath, component.content);
            changedFilePaths.push(filePath);
          }
        }

        return localComponentSet;
      } catch (error) {
        throw new Error(`Source tracking setup failed: ${error}`);
      }
    }

    return new ComponentSet();
  }
}

export const isSdrFailure = (fileResponse: FileResponse): fileResponse is FileResponseFailure =>
  fileResponse.state === ComponentStatus.Failed;

/**
 * Shared utility to create output tables for deploy and retrieve operations
 */
export interface OutputTableConfig {
  successColumns: { key: string; label: string }[];
  failureColumns: { key: string; label: string }[];
  successTitle: string;
  failureTitle: string;
  noResultsMessage?: string;
}

/**
 * Common column definitions to reduce duplication
 */
const COMMON_COLUMNS = {
  fullName: { key: 'fullName', label: nls.localize('table_header_full_name') },
  type: { key: 'type', label: nls.localize('table_header_type') },
  filePath: { key: 'filePath', label: nls.localize('table_header_project_path') },
  state: { key: 'state', label: nls.localize('table_header_state') },
  error: { key: 'error', label: nls.localize('table_header_errors') },
  message: { key: 'error', label: nls.localize('table_header_message') }
} as const;

export const createOutputTable = (
  fileResponses: FileResponse[],
  relativePackageDirs: string[],
  config: OutputTableConfig
): string => {
  const table = new Table();
  const successes: Row[] = [];
  const failures: Row[] = [];

  // Process file responses and separate successes from failures
  for (const response of fileResponses) {
    response.filePath = getRelativeProjectPath(response.filePath, relativePackageDirs);
    if (response.state !== ComponentStatus.Failed) {
      successes.push(response);
    } else {
      failures.push(response);
    }
  }

  let output = '';

  // Create success table if there are successful operations
  if (successes.length > 0) {
    output += table.createTable(successes, config.successColumns, config.successTitle);
  }

  // Create failure table if there are failed operations
  if (failures.length > 0) {
    if (successes.length > 0) {
      output += '\n';
    }
    output += table.createTable(failures, config.failureColumns, config.failureTitle);
  }

  // Handle case where there are no results - show empty table with title for deploy/push operations
  if (output === '') {
    if (config.noResultsMessage) {
      // For retrieve operations, use the noResultsMessage
      output = `${config.noResultsMessage}\n`;
    } else {
      // For deploy/push operations, show empty table with title (like old CLI behavior)
      output = table.createTable([], config.successColumns, config.successTitle);
      output += `\n${nls.localize('table_no_results_found')}\n`;
    }
  }

  return output;
};

/**
 * Operation type for output configuration
 */
export type OperationType = 'deploy' | 'retrieve' | 'push' | 'pull';

/**
 * Create output for deploy or retrieve operations
 */
export const createOperationOutput = (
  fileResponses: FileResponse[],
  relativePackageDirs: string[],
  operationType: OperationType,
  isSuccess?: boolean
): string => {
  // Base configuration for all operations
  const baseSuccessColumns = [COMMON_COLUMNS.fullName, COMMON_COLUMNS.type, COMMON_COLUMNS.filePath];
  const baseFailureColumns = [COMMON_COLUMNS.filePath, COMMON_COLUMNS.error];

  const configs: Record<OperationType, OutputTableConfig> = {
    deploy: {
      successColumns: [COMMON_COLUMNS.state, ...baseSuccessColumns],
      failureColumns: baseFailureColumns,
      successTitle: nls.localize('table_title_deployed_source'),
      failureTitle: nls.localize('table_title_deploy_errors')
    },
    push: {
      successColumns: [COMMON_COLUMNS.state, ...baseSuccessColumns],
      failureColumns: baseFailureColumns,
      successTitle: nls.localize('table_title_pushed_source'),
      failureTitle: nls.localize('table_title_push_errors')
    },
    retrieve: {
      successColumns: baseSuccessColumns,
      failureColumns: [COMMON_COLUMNS.fullName, COMMON_COLUMNS.type, COMMON_COLUMNS.message],
      successTitle: nls.localize('lib_retrieve_result_title'),
      failureTitle: nls.localize('lib_retrieve_message_title'),
      noResultsMessage: nls.localize('lib_retrieve_no_results')
    },
    pull: {
      successColumns: [COMMON_COLUMNS.state, ...baseSuccessColumns],
      failureColumns: [COMMON_COLUMNS.fullName, COMMON_COLUMNS.type, COMMON_COLUMNS.message],
      successTitle: nls.localize('table_title_pulled_source'),
      failureTitle: nls.localize('table_title_pull_errors')
    }
  };

  const responses =
    (operationType === 'deploy' || operationType === 'push') && isSuccess === false
      ? fileResponses.filter(isSdrFailure)
      : fileResponses;

  return createOutputTable(responses, relativePackageDirs, configs[operationType]);
};

/**
 * Create output for retrieve operations
 */
export const createRetrieveOrPullOutput = (
  fileResponses: FileResponse[],
  relativePackageDirs: string[],
  operationType: 'retrieve' | 'pull'
): string => createOperationOutput(fileResponses, relativePackageDirs, operationType);

/**
 * Create output for deploy or push operations
 */
export const createDeployOrPushOutput = (
  fileResponses: FileResponse[],
  relativePackageDirs: string[],
  isSuccess: boolean,
  operationType: 'deploy' | 'push'
): string => createOperationOutput(fileResponses, relativePackageDirs, operationType, isSuccess);
