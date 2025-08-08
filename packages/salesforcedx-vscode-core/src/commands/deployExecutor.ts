/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { getRootWorkspacePath, SourceTrackingService, SourceTrackingType } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet, DeployResult } from '@salesforce/source-deploy-retrieve-bundle';
import { ComponentStatus, RequestStatus } from '@salesforce/source-deploy-retrieve-bundle/lib/src/client/types';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { handleConflictsWithUI } from '../conflict/conflictUtils';
import { PersistentStorageService } from '../conflict/persistentStorageService';
import { WorkspaceContext, workspaceContextUtils } from '../context';
import { handleDeployDiagnostics } from '../diagnostics';
import { SalesforcePackageDirectories } from '../salesforceProject';
import { DeployQueue, salesforceCoreSettings } from '../settings';
import { DeployRetrieveOperationType } from '../util/types';
import { DeployRetrieveExecutor, createDeployOrPushOutput } from './baseDeployRetrieve';
import { SfCommandletExecutor } from './util';

export abstract class DeployExecutor<T> extends DeployRetrieveExecutor<T, DeployResult> {
  private sourceTracking?: SourceTrackingType;

  protected getOperationType(): DeployRetrieveOperationType {
    return 'deploy';
  }

  private deploy = async (
    components: ComponentSet,
    connection: any,
    token: vscode.CancellationToken,
    enableIgnoreConflicts: boolean = false
  ): Promise<DeployResult> => {
    if (enableIgnoreConflicts) {
      // Retry with ignoreConflicts: true
      this.sourceTracking?.setIgnoreConflicts(true);
    }

    const deployOperation = await components.deploy({
      usernameOrConnection: connection
    });
    this.setupCancellation(deployOperation, token);
    return await deployOperation.pollStatus();
  };

  protected async doOperation(
    components: ComponentSet,
    token: vscode.CancellationToken
  ): Promise<DeployResult | undefined> {
    // If no components to deploy, skip the actual deployment but still allow postOperation to run
    if (components.size === 0) {
      return undefined;
    }

    const projectPath = getRootWorkspacePath();
    const connection = await WorkspaceContext.getInstance().getConnection();
    components.projectDirectory = projectPath;
    const ignoreConflicts = !salesforceCoreSettings.getConflictDetectionEnabled() || this.ignoreConflicts;

    const sourceTrackingEnabled = salesforceCoreSettings.getEnableSourceTrackingForDeployAndRetrieve();
    if (sourceTrackingEnabled) {
      const orgType = await workspaceContextUtils.getWorkspaceOrgType();
      if (orgType === workspaceContextUtils.OrgType.SourceTracked) {
        this.sourceTracking = await SourceTrackingService.getSourceTracking(projectPath, connection, ignoreConflicts);
        await this.sourceTracking.ensureLocalTracking();
      }
    }

    // Check for conflicts using SourceTracking before the operation
    if (this.sourceTracking && !ignoreConflicts) {
      const conflicts = await this.sourceTracking.getConflicts();
      if (conflicts?.length > 0) {
        // Show conflict UI and let user decide
        const conflictResult = await handleConflictsWithUI(
          conflicts,
          this.getLogName(),
          this.getOperationType(),
          async () => await this.deploy(components, connection, token, false),
          async () => await this.deploy(components, connection, token, true)
        );
        if (conflictResult === undefined) {
          // User cancelled - throw a cancellation error to prevent success notification
          throw new Error('CONFLICT_CANCELLED');
        }
        // User chose to continue, conflictResult contains the deployment result
        return conflictResult;
      }
    }

    // Execute the deployment operation (no conflicts detected or conflict detection disabled)
    const result = await this.deploy(components, connection, token, false);

    if (!result) {
      // User cancelled due to conflicts
      throw new Error();
    }

    if (sourceTrackingEnabled) {
      const status = result?.response?.status;
      if ((status === RequestStatus.Succeeded || status === RequestStatus.SucceededPartial) && this.sourceTracking) {
        await SourceTrackingService.updateSourceTrackingAfterDeploy(this.sourceTracking, result);
      }
    }
    return result;
  }

  protected async postOperation(result: DeployResult | undefined): Promise<void> {
    try {
      if (result) {
        // Update Persistent Storage for the files that were deployed
        PersistentStorageService.getInstance().setPropertiesForFilesDeploy(result);

        const relativePackageDirs = await SalesforcePackageDirectories.getPackageDirectoryPaths();
        const output = this.createOutput(result, relativePackageDirs);
        channelService.appendLine(output);

        // Always show diagnostics if there are failed components, regardless of overall status
        const hasFailedComponents = result
          .getFileResponses()
          .some(fileResponse => fileResponse.state === ComponentStatus.Failed);

        if (hasFailedComponents) {
          this.unsuccessfulOperationHandler(result, DeployRetrieveExecutor.errorCollection);
        } else {
          DeployRetrieveExecutor.errorCollection.clear();
          SfCommandletExecutor.errorCollection.clear();
        }
      } else {
        // Handle case where no components were deployed (empty ComponentSet)
        this.handleEmptyComponentSet(this.getOperationType(), true);
      }
    } finally {
      await DeployQueue.get().unlock();
    }
  }

  protected unsuccessfulOperationHandler(result: DeployResult, errorCollection: vscode.DiagnosticCollection) {
    handleDeployDiagnostics(result, errorCollection);
  }

  private createOutput(result: DeployResult, relativePackageDirs: string[]): string {
    const isSuccess =
      result.response.status === RequestStatus.Succeeded || result.response.status === RequestStatus.SucceededPartial;

    return createDeployOrPushOutput(result.getFileResponses(), relativePackageDirs, isSuccess, this.getOperationType());
  }
}
