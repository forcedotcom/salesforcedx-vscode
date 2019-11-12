/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { channelService } from '../channels';
import { getWorkspaceOrgType, OrgType } from '../context';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { sfdxCoreSettings } from '../settings';
import { SfdxPackageDirectories } from '../sfdxProject';

import * as path from 'path';
import { setTimeout } from 'timers';
import * as vscode from 'vscode';
import { telemetryService } from '../telemetry';
import { hasRootWorkspace, OrgAuthInfo } from '../util';

export class DeployQueue {
  public static readonly ENQUEUE_DELAY = 500; // milliseconds

  private static instance: DeployQueue;

  private readonly queue = new Set<vscode.Uri>();
  private timer: NodeJS.Timer | undefined;
  private locked = false;
  private deployWaitStart?: [number, number];

  private constructor() {}

  public static get(): DeployQueue {
    if (!DeployQueue.instance) {
      DeployQueue.instance = new DeployQueue();
    }
    return DeployQueue.instance;
  }

  public static reset() {
    if (DeployQueue.instance) {
      if (DeployQueue.instance.timer) {
        clearTimeout(DeployQueue.instance.timer);
      }
      DeployQueue.instance = new DeployQueue();
    }
  }

  public async enqueue(document: vscode.Uri) {
    this.queue.add(document);
    await this.wait();
    await this.doDeploy();
  }

  public async unlock() {
    this.locked = false;
    await this.wait();
    await this.doDeploy();
  }

  private async wait() {
    return new Promise(resolve => {
      if (this.timer) {
        clearTimeout(this.timer);
      }
      this.timer = setTimeout(resolve, DeployQueue.ENQUEUE_DELAY);
    });
  }

  private async doDeploy(): Promise<void> {
    if (!this.locked && this.queue.size > 0) {
      this.locked = true;
      const toDeploy = Array.from(this.queue);
      this.queue.clear();
      try {
        let defaultUsernameorAlias: string | undefined;
        if (hasRootWorkspace()) {
          defaultUsernameorAlias = await OrgAuthInfo.getDefaultUsernameOrAlias(
            false
          );
        }
        const orgType = await getWorkspaceOrgType(defaultUsernameorAlias);
        if (orgType === OrgType.SourceTracked) {
          vscode.commands.executeCommand('sfdx.force.source.push');
        } else {
          vscode.commands.executeCommand(
            'sfdx.force.source.deploy.multiple.source.paths',
            toDeploy
          );
        }

        telemetryService.sendEventData(
          'deployOnSave',
          {
            deployType: orgType === OrgType.SourceTracked ? 'Push' : 'Deploy'
          },
          {
            documentsToDeploy: toDeploy.length,
            waitTimeForLastDeploy: this.deployWaitStart
              ? parseFloat(telemetryService.getEndHRTime(this.deployWaitStart))
              : 0
          }
        );
      } catch (e) {
        switch (e.name) {
          case 'NamedOrgNotFound':
            displayError(nls.localize('error_fetching_auth_info_text'));
            break;
          case 'NoDefaultusernameSet':
            displayError(
              nls.localize('error_push_or_deploy_on_save_no_default_username')
            );
            break;
          default:
            displayError(e.message);
        }
        this.locked = false;
      }
      this.deployWaitStart = undefined;
    } else if (this.locked && !this.deployWaitStart) {
      this.deployWaitStart = process.hrtime();
    }
  }
}

export async function registerPushOrDeployOnSave() {
  vscode.workspace.onDidSaveTextDocument(
    async (textDocument: vscode.TextDocument) => {
      if (
        sfdxCoreSettings.getPushOrDeployOnSaveEnabled() &&
        !(await ignorePath(textDocument.uri))
      ) {
        await DeployQueue.get().enqueue(textDocument.uri);
      }
    }
  );
}

function displayError(message: string) {
  notificationService.showErrorMessage(message);
  channelService.appendLine(message);
  channelService.showChannelOutput();
  telemetryService.sendException(
    'push_deploy_on_save_queue',
    `DeployOnSaveError: Documents were queued but a deployment was not triggered`
  );
}

async function ignorePath(uri: vscode.Uri) {
  return isDotFile(uri) || !(await pathIsInPackageDirectory(uri));
}

export async function pathIsInPackageDirectory(
  documentUri: vscode.Uri
): Promise<boolean> {
  const documentPath = documentUri.fsPath;
  try {
    return await SfdxPackageDirectories.isInPackageDirectory(documentPath);
  } catch (error) {
    switch (error.name) {
      case 'NoPackageDirectoriesFound':
        error.message = nls.localize(
          'error_no_package_directories_found_on_setup_text'
        );
        break;
      case 'NoPackageDirectoryPathsFound':
        error.message = nls.localize(
          'error_no_package_directories_paths_found_text'
        );
        break;
    }
    displayError(error.message);
    throw error;
  }
}

function isDotFile(uri: vscode.Uri) {
  return path.basename(uri.fsPath).startsWith('.');
}
