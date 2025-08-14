/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Lifecycle, Org, SfError, SfProject } from '@salesforce/core-bundle';

import {
  createDirectory,
  deleteFile,
  writeFile,
  readFile,
  rename,
  workspaceUtils,
  fileUtils,
  ContinueResponse,
  LibraryCommandletExecutor,
  errorToString
} from '@salesforce/salesforcedx-utils-vscode';
import {
  ComponentSet,
  ComponentSetBuilder,
  ComponentStatus,
  DeployResult,
  DestructiveChangesType,
  FileResponseSuccess,
  RequestStatus,
  SourceComponent
} from '@salesforce/source-deploy-retrieve-bundle';
import { ChangeResult, SourceTracking, deleteCustomLabels } from '@salesforce/source-tracking-bundle';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { OUTPUT_CHANNEL } from '../channels';
import { OrgType, workspaceContextUtils } from '../context';
import { WorkspaceContext } from '../context/workspaceContext';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { componentSetUtils } from '../services/sdr/componentSetUtils';
import { getUriFromActiveEditor } from './util/getUriFromActiveEditor';

type MixedDeployDelete = { deploy: string[]; delete: FileResponseSuccess[] };

export class DeleteSourceExecutor extends LibraryCommandletExecutor<{ filePath: string }> {
  private org: Org;
  private componentSet: ComponentSet | undefined;
  private deployResult: DeployResult | undefined;
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
    _progress?: vscode.Progress<{
      message?: string | undefined;
      increment?: number | undefined;
    }>,
    _token?: vscode.CancellationToken
  ): Promise<boolean> {
    await this.preChecks();
    await this.delete(response.data.filePath);
    await this.handleDeployResult();
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

    const cs = originalComponents.reduce((destructiveSet, component) => {
      if (component instanceof SourceComponent) {
        destructiveSet.add(component, DestructiveChangesType.POST);
      } else {
        // a remote-only delete
        destructiveSet.add(
          new SourceComponent({ name: component.fullName, type: component.type }),
          DestructiveChangesType.POST
        );
      }
      return destructiveSet;
    }, new ComponentSet([]));

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

  private async handleDeployResult(): Promise<void> {
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
      throw new SfError(nls.localize('delete_source_operation_failed'), 'DeleteFailed');
    }

    // Handle successful deployment
    if (this.mixedDeployDelete.delete.length > 0) {
      // successful delete -> delete the stashed file
      await deleteFile(path.join(os.tmpdir(), 'source_delete'), { recursive: true });
    }

    // Delete local files after successful deployment
    await this.deleteFilesLocally();

    // Update source tracking after successful deployment
    await this.updateSourceTracking();
  }

  private async deleteFilesLocally(): Promise<void> {
    const components = this.componentSet?.getSourceComponents().toArray() ?? [];

    // Find custom labels and create deletion promise
    const customLabels = components.filter(isNonDecomposedCustomLabel);
    const promisesFromLabels = customLabels[0]?.xml ? [deleteCustomLabels(customLabels[0].xml, customLabels)] : [];

    // mixed delete/deploy operations have already been deleted and stashed
    const otherPromises =
      this.mixedDeployDelete.delete.length === 0
        ? (this.componentSet?.toArray() ?? []).reduce<Promise<void>[]>((promises, component) => {
            if (component instanceof SourceComponent) {
              if (component.content) {
                promises.push(deleteFile(component.content, { recursive: true, useTrash: false }));
              }
              if (component.xml && !isNonDecomposedCustomLabel(component)) {
                promises.push(deleteFile(component.xml));
              }
            }
            return promises;
          }, [])
        : [];

    await Promise.all([...promisesFromLabels, ...otherPromises]);
  }

  private async updateSourceTracking(): Promise<void> {
    if (this.isSourceTracked && this.tracking && this.deployResult) {
      // update both local and remote tracking
      await this.tracking.updateTrackingFromDeploy(this.deployResult);
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
  try {
    await executor.run({ type: 'CONTINUE', data: { filePath } });
  } catch (error) {
    notificationService.showErrorMessage(
      nls.localize('delete_source_operation_failed_with_error', errorToString(error))
    );
    throw error;
  }
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
  await deleteFile(file);
};

export const someContentsEndWithPath =
  (cmp: SourceComponent) =>
  (sourcePath: string): boolean =>
    // walkContent returns absolute paths while sourcepath will usually be relative
    cmp.walkContent().some(content => content.endsWith(sourcePath));

export const allChildrenAreNotAddressable = (comp: any): boolean => {
  const types = Object.values(comp.type.children?.types ?? {});
  return !types.some((child: any) => child.isAddressable);
};

export const isNonDecomposedCustomLabel = (component: any): boolean =>
  component.type.name === 'CustomLabel' && !component.type.strategies?.adapter;
