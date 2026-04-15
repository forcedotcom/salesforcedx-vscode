/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core';
import { getRootWorkspacePath, SourceTrackingService, SourceTrackingType } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet, RetrieveResult } from '@salesforce/source-deploy-retrieve';
import { RequestStatus } from '@salesforce/source-deploy-retrieve/lib/src/client/types';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { handleConflictsWithUI } from '../conflict/conflictUtils';
import { assertConflictLogName } from '../conflict/messages';
import { PersistentStorageService } from '../conflict/persistentStorageService';
import { WorkspaceContext, workspaceContextUtils } from '../context';
import { SalesforcePackageDirectories } from '../salesforceProject';
import { salesforceCoreSettings } from '../settings';
import { DeployRetrieveOperationType } from '../util/types';
import { DeployRetrieveExecutor, createOperationOutput, handleEmptyComponentSet } from './baseDeployRetrieve';
import { SfCommandletExecutor } from './util';

export abstract class RetrieveExecutor<T> extends DeployRetrieveExecutor<T, RetrieveResult> {
  private sourceTracking?: SourceTrackingType;

  protected readonly operationType: DeployRetrieveOperationType = 'retrieve';

  private retrieve = async (
    components: ComponentSet,
    connection: Connection,
    defaultOutput: string,
    token: vscode.CancellationToken,
    enableIgnoreConflicts: boolean = false
  ): Promise<RetrieveResult> => {
    if (enableIgnoreConflicts) {
      // Retry with ignoreConflicts: true
      this.sourceTracking?.setIgnoreConflicts(true);
    }

    const retrieveOperation = await components.retrieve({
      usernameOrConnection: connection,
      output: defaultOutput,
      merge: true,
      suppressEvents: false
    });
    this.setupCancellation(retrieveOperation, token);
    return await retrieveOperation.pollStatus();
  };

  protected async doOperation(
    components: ComponentSet,
    token: vscode.CancellationToken
  ): Promise<RetrieveResult | undefined> {
    // If no components to retrieve, skip the actual operation but still allow postOperation to run
    if (components.size === 0) {
      return undefined;
    }

    const projectPath = getRootWorkspacePath();
    const connection = await WorkspaceContext.getInstance().getConnection();

    // Set up source tracking based on org type and settings:
    // - Source-tracked orgs: Use source tracking only if the setting is enabled (for performance control) if it's a retrieve, if it's a pull always use source tracking
    // - Non-source-tracked orgs: Never use source tracking
    const orgType = await workspaceContextUtils.getWorkspaceOrgType();
    const sourceTrackingEnabled = salesforceCoreSettings.getEnableSourceTrackingForDeployAndRetrieve();

    if (
      orgType === workspaceContextUtils.OrgType.SourceTracked &&
      (this.operationType === 'pull' || sourceTrackingEnabled)
    ) {
      this.sourceTracking = await SourceTrackingService.getSourceTracking(
        projectPath,
        connection,
        this.ignoreConflicts
      );
      // Force remote tracking refresh to ensure we get the latest changes
      await this.sourceTracking.ensureRemoteTracking(true);
    }

    const defaultOutput = join(projectPath, (await SalesforcePackageDirectories.getDefaultPackageDir()) ?? '');

    // Check for conflicts using SourceTracking before the operation
    if (this.sourceTracking && !this.ignoreConflicts) {
      const conflicts = await this.sourceTracking.getConflicts();
      if (conflicts?.length > 0) {
        // Show conflict UI and let user decide
        const conflictResult = await handleConflictsWithUI(
          conflicts,
          assertConflictLogName(this.logName),
          this.operationType,
          async () => await this.retrieve(components, connection, defaultOutput, token, false),
          async () => await this.retrieve(components, connection, defaultOutput, token, true)
        );
        if (conflictResult === undefined) {
          // User cancelled - throw a cancellation error to prevent success notification
          throw new Error('CONFLICT_CANCELLED');
        }
        // User chose to continue, conflictResult contains the retrieve result
        return conflictResult;
      }
    }

    // Execute the retrieve operation (no conflicts detected or conflict detection disabled)
    const result = await this.retrieve(components, connection, defaultOutput, token, this.ignoreConflicts);
    // Update source tracking after successful retrieve if we have source tracking set up
    if (this.sourceTracking) {
      const status = result?.response?.status;
      if (status === RequestStatus.Succeeded || status === RequestStatus.SucceededPartial) {
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
    } else {
      // Handle case where no components were deployed (empty ComponentSet)
      handleEmptyComponentSet(this.operationType, true);
    }
  }

  private createOutput(result: RetrieveResult, relativePackageDirs: string[]): string {
    return createOperationOutput(result.getFileResponses(), relativePackageDirs, this.operationType);
  }
}
