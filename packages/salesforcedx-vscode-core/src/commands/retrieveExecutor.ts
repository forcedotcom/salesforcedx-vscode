/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { getRootWorkspacePath, SourceTrackingService, SourceTrackingType } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet, RetrieveResult } from '@salesforce/source-deploy-retrieve-bundle';
import { RequestStatus } from '@salesforce/source-deploy-retrieve-bundle/lib/src/client/types';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { PersistentStorageService } from '../conflict/persistentStorageService';
import { WorkspaceContext, workspaceContextUtils } from '../context';
import { SalesforcePackageDirectories } from '../salesforceProject';
import { salesforceCoreSettings } from '../settings';
import { DeployRetrieveExecutor, createRetrieveOrPullOutput } from './baseDeployRetrieve';
import { SfCommandletExecutor } from './util';

export abstract class RetrieveExecutor<T> extends DeployRetrieveExecutor<T, RetrieveResult> {
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
    } else {
      // Handle case where no components were deployed (empty ComponentSet)
      const relativePackageDirs = await SalesforcePackageDirectories.getPackageDirectoryPaths();
      const operationType = this.isPullOperation() ? 'pull' : 'retrieve';
      const output = createRetrieveOrPullOutput([], relativePackageDirs, operationType);
      channelService.appendLine(output);

      // Clear any existing errors since this is a successful "no changes" scenario
      DeployRetrieveExecutor.errorCollection.clear();
      SfCommandletExecutor.errorCollection.clear();
    }
  }

  private createOutput(result: RetrieveResult, relativePackageDirs: string[]): string {
    const operationType = this.isPullOperation() ? 'pull' : 'retrieve';
    return createRetrieveOrPullOutput(result.getFileResponses(), relativePackageDirs, operationType);
  }
}
