/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Lifecycle, Org, SfError, SfProject } from '@salesforce/core';

import {
  ContinueResponse,
  LibraryCommandletExecutor,
  createDirectory,
  deleteFile,
  fileUtils,
  readFile,
  rename,
  workspaceUtils,
  writeFile
} from '@salesforce/salesforcedx-utils-vscode';
import {
  ComponentSet,
  ComponentSetBuilder,
  ComponentStatus,
  DeployResult,
  DestructiveChangesType,
  FileResponse,
  FileResponseSuccess,
  RequestStatus,
  SourceComponent
} from '@salesforce/source-deploy-retrieve';
import { ChangeResult, SourceTracking, deleteCustomLabels } from '@salesforce/source-tracking';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { OUTPUT_CHANNEL, channelService } from '../channels';
import { OrgType, workspaceContextUtils } from '../context';
import { WorkspaceContext } from '../context/workspaceContext';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { SalesforcePackageDirectories } from '../salesforceProject';
import { componentSetUtils } from '../services/sdr/componentSetUtils';
import { createOperationOutput } from './baseDeployRetrieve';
import { getUriFromActiveEditor } from './util/getUriFromActiveEditor';

type MixedDeployDelete = { deploy: string[]; delete: FileResponseSuccess[] };

export class DeleteSourceExecutor extends LibraryCommandletExecutor<{ filePath: string }> {
  private org: Org;
  private componentSet: ComponentSet | undefined;
  private deployResult: DeployResult | undefined;
  private fileResponses: FileResponse[] | undefined;
  private mixedDeployDelete: MixedDeployDelete = { delete: [], deploy: [] };
  private stashPath = new Map<string, string>();
  private tracking: SourceTracking | undefined;
  private isSourceTracked: boolean;
  private project: SfProject | undefined;

  constructor(isSourceTracked: boolean, org: Org, project?: SfProject) {
    super(nls.localize('delete_source_text'), 'project_delete_source', OUTPUT_CHANNEL);
    this.org = org;
    this.isSourceTracked = isSourceTracked;
    this.project = project;
  }

  public async run(
    response: ContinueResponse<{ filePath: string }>,
    progress?: vscode.Progress<{
      message?: string | undefined;
      increment?: number | undefined;
    }>,
    _token?: vscode.CancellationToken
  ): Promise<boolean> {
    // Update progress notification instead of logging to output channel
    progress?.report({ message: 'Checking for conflicts...' });
    await this.preChecks();

    progress?.report({ message: 'Deploying delete to org...' });
    await this.delete(response.data.filePath);

    // Follow CLI pattern: resolveSuccess, deleteFilesLocally, updateTracking
    progress?.report({ message: 'Processing deployment results...' });
    await this.resolveSuccess();

    progress?.report({ message: 'Deleting local files...' });
    await this.deleteFilesLocally();

    progress?.report({ message: 'Updating source tracking...' });
    await this.maybeUpdateTracking();

    // Show results table like other deploy operations
    progress?.report({ message: 'Formatting results...' });
    await this.displayResults();

    // Return true to trigger LibraryCommandletExecutor's success notification
    return true;
  }

  private async preChecks(): Promise<void> {
    if (this.isSourceTracked) {
      this.project ??= await SfProject.resolve();
      this.tracking = await SourceTracking.create({
        org: this.org,
        project: this.project,
        ignoreLocalCache: true
      });
      // Check for conflicts before proceeding
      const conflicts = await this.tracking.getConflicts();
      if (conflicts?.length > 0) {
        const conflictDetails = conflicts.map(
          (c: ChangeResult) => `${c.type}:${c.name} (${(c.filenames ?? []).join(', ')})`
        );
        throw new SfError(
          `${nls.localize('delete_source_conflicts_detected')} Conflicts: ${conflictDetails.join(', ')}`,
          'SourceConflictDetected'
        );
      }
    }
  }

  private async delete(filePath: string): Promise<void> {
    const sourcepaths = [filePath];

    this.componentSet = await ComponentSetBuilder.build({
      sourcepath: sourcepaths,
      projectDir: workspaceUtils.getRootWorkspacePath()
    });

    await componentSetUtils.setApiVersion(this.componentSet);
    await componentSetUtils.setSourceApiVersion(this.componentSet);

    if (this.componentSet.size === 0) {
      notificationService.showInformationMessage(nls.localize('delete_source_no_components_found'));
      return;
    }

    // Create a new ComponentSet and mark everything for deletion
    const originalComponents = this.componentSet.toArray();

    const cs = new ComponentSet([]);
    originalComponents.map(component => {
      if (component instanceof SourceComponent) {
        cs.add(component, DestructiveChangesType.POST);
      } else {
        // a remote-only delete
        cs.add(new SourceComponent({ name: component.fullName, type: component.type }), DestructiveChangesType.POST);
      }
    });

    cs.apiVersion = this.componentSet.apiVersion;
    cs.sourceApiVersion = this.componentSet.sourceApiVersion;
    this.componentSet = cs;

    if (sourcepaths) {
      await Promise.all([
        // determine if user is trying to delete a single file from a bundle, which is actually just an fs delete operation
        // and then a constructive deploy on the "new" bundle
        ...originalComponents
          .filter(comp => comp.type.strategies?.adapter === 'bundle')
          .filter((comp): comp is SourceComponent => comp instanceof SourceComponent)
          .flatMap(bundle =>
            sourcepaths
              .filter(someContentsEndWithPath(bundle))
              .map(sourcepath =>
                this.moveToManifest(bundle, sourcepath, path.join(bundle.name, path.basename(sourcepath)))
              )
          ),
        // same for decomposed components with non-addressable children (ex: decomposedPermissionSet.  Deleting a file means "redploy without that")
        ...originalComponents
          .filter(allChildrenAreNotAddressable)
          .filter((comp): comp is SourceComponent => comp instanceof SourceComponent)
          .flatMap(decomposed =>
            sourcepaths
              .filter(someContentsEndWithPath(decomposed))
              .map(sourcepath => this.moveToManifest(decomposed, sourcepath, decomposed.fullName))
          )
      ]);
    }

    // fire predeploy event for the delete
    await Lifecycle.getInstance().emit('predeploy', originalComponents);

    const username = this.org.getUsername();
    if (!username) {
      throw new SfError(nls.localize('delete_source_no_username_found'), 'NoUsernameFound');
    }

    const deployOperation = await this.componentSet.deploy({
      usernameOrConnection: username,
      apiOptions: {
        rest: true,
        checkOnly: false
      }
    });

    this.deployResult = await deployOperation.pollStatus();

    await Lifecycle.getInstance().emit('postdeploy', this.deployResult);
  }

  /**
   * Checks the response status to determine whether the delete was successful.
   * Following CLI resolveSuccess() method exactly
   */
  private async resolveSuccess(): Promise<void> {
    // Extract file responses early like CLI does - this preserves error details for display
    this.fileResponses =
      this.mixedDeployDelete.delete.length > 0 ? this.mixedDeployDelete.delete : this.deployResult?.getFileResponses();

    // if deploy failed restore the stashed files if they exist
    if (this.deployResult && this.deployResult.response?.status !== RequestStatus.Succeeded) {
      await Promise.all(
        this.mixedDeployDelete.delete.map(async file => {
          const stashSource = this.stashPath.get(file.filePath);
          if (!stashSource) {
            throw new Error(nls.localize('delete_source_stash_source_not_found', file.filePath));
          }
          await rename(stashSource, file.filePath);
        })
      );

      // Following CLI pattern: show detailed errors and throw
      await this.showDetailedErrors();
      throw new SfError(nls.localize('delete_source_operation_failed'), 'DeleteFailed');
    } else if (this.mixedDeployDelete.delete.length > 0) {
      // successful delete -> delete the stashed file (following CLI deleteStash pattern)
      await deleteFile(path.join(os.tmpdir(), 'source_delete'), { recursive: true, useTrash: false });
    }
  }

  private async showDetailedErrors(): Promise<void> {
    if (!this.deployResult) {
      return;
    }

    try {
      // Following CLI pattern: use the proper fileResponses and format like other deploy operations
      const fileResponses = this.fileResponses ?? this.deployResult.getFileResponses();
      const relativePackageDirs = await SalesforcePackageDirectories.getPackageDirectoryPaths();

      const output = createOperationOutput(
        fileResponses,
        relativePackageDirs,
        'deploy', // Use 'deploy' operation type for error formatting
        false // isSuccess = false to show error details
      );

      // Display the detailed error information in the output channel
      channelService.appendLine('=== DELETE OPERATION ERRORS ===');
      channelService.appendLine(output);
      channelService.showChannelOutput();
    } catch {
      // Fallback to basic error information if detailed formatting fails
      const fileResponses = this.deployResult.getFileResponses();
      const failedResponses = fileResponses.filter(response => response.state === ComponentStatus.Failed);

      if (failedResponses.length > 0) {
        channelService.appendLine('Delete operation failed with the following errors:');
        failedResponses.forEach(response => {
          const filePath = 'filePath' in response ? (response.filePath ?? 'Unknown file') : 'Unknown file';
          const errorMsg =
            'error' in response
              ? `${filePath}: ${response.error ?? 'Unknown error'}`
              : `${filePath}: Success (unexpected)`;
          channelService.appendLine(errorMsg);
        });
        channelService.showChannelOutput();
      }
    }
  }

  private async deleteFilesLocally(): Promise<void> {
    // Following CLI pattern: only delete files if deployment succeeded
    if (!this.deployResult || this.deployResult.response?.status !== RequestStatus.Succeeded) {
      return;
    }

    const components = this.componentSet?.getSourceComponents().toArray() ?? [];

    // Find custom labels and create deletion promise (same as CLI)
    const customLabels = components.filter(isNonDecomposedCustomLabel);
    const promisesFromLabels = customLabels[0]?.xml ? [deleteCustomLabels(customLabels[0].xml, customLabels)] : [];

    // Follow CLI pattern: only delete if not mixed deploy/delete operations
    const otherPromises =
      this.mixedDeployDelete.delete.length === 0
        ? (this.componentSet?.toArray() ?? [])
            .filter((component): component is SourceComponent => component instanceof SourceComponent)
            .flatMap((component: SourceComponent) => [
              ...(component.content ? [deleteFile(component.content, { recursive: true, useTrash: false })] : []),
              ...(component.xml && !isNonDecomposedCustomLabel(component) ? [deleteFile(component.xml)] : [])
            ])
        : [];

    await Promise.all([...promisesFromLabels, ...otherPromises]);
  }

  /**
   * Update source tracking following CLI maybeUpdateTracking() method exactly
   */
  private async maybeUpdateTracking(): Promise<void> {
    if (this.isSourceTracked) {
      // might not exist if we exited from the operation early
      if (!this.deployResult) {
        return;
      }

      const successes = (this.fileResponses ?? this.deployResult.getFileResponses()).filter(
        (response): response is FileResponseSuccess => response.state !== ComponentStatus.Failed
      );

      if (successes.length === 0) {
        return;
      }

      await Promise.all([
        this.tracking?.updateLocalTracking({
          files: successes
            .filter(fileResponse => fileResponse.state !== ComponentStatus.Deleted)
            .map(fileResponse => fileResponse.filePath),
          deletedFiles: successes
            .filter(fileResponse => fileResponse.state === ComponentStatus.Deleted)
            .map(fileResponse => fileResponse.filePath)
        }),
        this.tracking?.updateRemoteTracking(
          successes.map(response => ({
            fullName: response.fullName,
            type: response.type,
            state: response.state,
            filePath: response.filePath
          }))
        )
      ]);
    }
  }

  private async displayResults(): Promise<void> {
    if (!this.deployResult) {
      return;
    }

    try {
      // Use the file responses we extracted earlier for consistent formatting
      const fileResponses = this.fileResponses ?? this.deployResult.getFileResponses();
      const relativePackageDirs = await SalesforcePackageDirectories.getPackageDirectoryPaths();

      // Format and display the results table
      const output = createOperationOutput(
        fileResponses,
        relativePackageDirs,
        'delete', // Use deploy operation type for consistent formatting
        this.deployResult.response?.status === RequestStatus.Succeeded
      );

      channelService.appendLine(output);
    } catch {
      // Fallback to basic output if formatting fails
      const fileResponses = this.deployResult.getFileResponses();
      const deletedResponses = fileResponses.filter(
        response => response.state === ComponentStatus.Deleted || response.state === ComponentStatus.Failed
      );

      if (deletedResponses.length > 0) {
        channelService.appendLine('\n=== Deleted Source ===');
        deletedResponses.forEach(response => {
          const filePath = 'filePath' in response ? (response.filePath ?? 'Unknown file') : 'Unknown file';
          channelService.appendLine(`Deleted: ${response.type}:${response.fullName} - ${filePath}`);
        });
      }
    }
  }

  private async moveToManifest(cmp: SourceComponent, sourcepath: string, fullName: string): Promise<void> {
    this.mixedDeployDelete.delete.push({
      state: ComponentStatus.Deleted,
      fullName,
      type: cmp.type.name,
      filePath: sourcepath
    });

    // stash the file in case we need to restore it due to failed deploy/aborted command
    this.stashPath.set(sourcepath, path.join(os.tmpdir(), 'source_delete', fullName));
    await moveFileToStash(this.stashPath, sourcepath);
    // re-walk the directory to avoid picking up the deleted file
    this.mixedDeployDelete.deploy.push(...cmp.walkContent());

    // now from destructive changes and add to manifest
    // set NOT marked for delete
    this.componentSet?.destructiveChangesPost.delete(`${cmp.type.id}#${cmp.fullName}`);
    cmp.setMarkedForDelete(false);
    this.componentSet?.add(cmp);
  }
}

/**
 * Checks if the given URI is a manifest file
 */
export const isManifestFile = (uri: URI): boolean => {
  if (!workspaceUtils.hasRootWorkspace()) {
    return false;
  }
  const workspaceRootPath = workspaceUtils.getRootWorkspacePath();
  const manifestPath = path.join(workspaceRootPath, 'manifest');
  const explorerPath = fileUtils.flushFilePath(uri.fsPath);
  return explorerPath.includes(manifestPath);
};

/**
 * Shows confirmation dialog for delete source operation
 */
export const showDeleteConfirmation = async (): Promise<boolean> => {
  const PROCEED = nls.localize('confirm_delete_source_button_text');
  const CANCEL = nls.localize('cancel_delete_source_button_text');
  const prompt = nls.localize('delete_source_confirmation_message');
  const response = await vscode.window.showInformationMessage(prompt, PROCEED, CANCEL);
  return response === PROCEED;
};

/**
 * Gets the org instance for delete source operations
 */
export const getOrg = async (): Promise<Org> => {
  const workspaceContext = WorkspaceContext.getInstance();
  const connection = await workspaceContext.getConnection();
  return await Org.create({ connection });
};

/**
 * Gets the project instance if working with a source-tracked org
 */
export const getProjectIfSourceTracked = async (): Promise<SfProject | undefined> => {
  const orgType = await workspaceContextUtils.getWorkspaceOrgType();
  const isSourceTracked = orgType === OrgType.SourceTracked;

  if (isSourceTracked) {
    return await SfProject.resolve();
  }

  return undefined;
};

export const deleteSource = async (sourceUri: URI) => {
  const resolved =
    sourceUri ??
    (await getUriFromActiveEditor({
      message: 'delete_source_select_file_or_directory',
      exceptionKey: 'project_delete_source'
    }));
  if (!resolved) {
    return;
  }

  // Check if it's a manifest file (precondition check)
  if (isManifestFile(resolved)) {
    notificationService.showErrorMessage(nls.localize('delete_source_manifest_unsupported_message'));
    return;
  }

  // User confirmation
  const confirmed = await showDeleteConfirmation();
  if (!confirmed) {
    return;
  }

  // Get org and project instances
  const org = await getOrg();
  const project = await getProjectIfSourceTracked();

  const filePath = fileUtils.flushFilePath(resolved.fsPath);
  const orgType = await workspaceContextUtils.getWorkspaceOrgType();
  const isSourceTracked = orgType === OrgType.SourceTracked;

  const executor = new DeleteSourceExecutor(isSourceTracked, org, project);

  // Execute the delete operation
  await executor.execute({ type: 'CONTINUE', data: { filePath } });
};

// Utility functions
export const moveFileToStash = async (stashPath: Map<string, string>, file: string): Promise<void> => {
  const stashTarget = stashPath.get(file);
  if (!stashTarget) {
    throw new Error(nls.localize('delete_source_stash_target_not_found', file));
  }
  await createDirectory(path.dirname(stashTarget));
  const fileContent = await readFile(file);
  await writeFile(stashTarget, fileContent);
  // Don't delete the original file here - it will be deleted after successful deployment
};

const someContentsEndWithPath =
  (cmp: SourceComponent) =>
  (sourcePath: string): boolean =>
    // walkContent returns absolute paths while sourcepath will usually be relative
    cmp.walkContent().some(content => content.endsWith(sourcePath));

const allChildrenAreNotAddressable = (comp: any): boolean => {
  const types = Object.values(comp.type.children?.types ?? {});
  return types.length > 0 && types.every((child: any) => child.isAddressable === false);
};

const isNonDecomposedCustomLabel = (component: any): boolean =>
  component.type.name === 'CustomLabel' && !component.type.strategies?.adapter;
