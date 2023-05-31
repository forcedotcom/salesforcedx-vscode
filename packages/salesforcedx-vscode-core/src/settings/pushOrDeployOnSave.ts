/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { channelService } from '../channels';
import { OrgType, workspaceContextUtils } from '../context';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { sfdxCoreSettings } from '../settings';
import { SfdxPackageDirectories } from '../sfdxProject';

import * as path from 'path';
import { setTimeout } from 'timers';
import * as vscode from 'vscode';
import { telemetryService } from '../telemetry';

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

  private async executeDeployCommand(toDeploy: vscode.Uri[]) {
    vscode.commands.executeCommand(
      'sfdx.force.source.deploy.multiple.source.paths',
      toDeploy
    );
  }

  private async executePushCommand() {
    const forceCommand = sfdxCoreSettings.getPushOrDeployOnSaveOverrideConflicts()
      ? '.force'
      : '';
    const command = `sfdx.force.source.push${forceCommand}`;
    vscode.commands.executeCommand(command);
  }

  private async doDeploy(): Promise<void> {
    if (!this.locked && this.queue.size > 0) {
      this.locked = true;
      const toDeploy = Array.from(this.queue);
      this.queue.clear();
      let deployType: string = '';
      try {
        const preferDeployOnSaveEnabled = sfdxCoreSettings.getPreferDeployOnSaveEnabled();
        if (preferDeployOnSaveEnabled) {
          await this.executeDeployCommand(toDeploy);
          deployType = 'Deploy';
        } else {
          const orgType = await workspaceContextUtils.getWorkspaceOrgType();
          if (orgType === OrgType.SourceTracked) {
            await this.executePushCommand();
            deployType = 'Push';
          } else {
            await this.executeDeployCommand(toDeploy);
            deployType = 'Deploy';
          }
        }

        telemetryService.sendEventData(
          'deployOnSave',
          {
            deployType
          },
          {
            documentsToDeploy: toDeploy.length,
            waitTimeForLastDeploy: this.deployWaitStart
              ? telemetryService.getEndHRTime(this.deployWaitStart)
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
      const documentUri = textDocument.uri;
      if (
        sfdxCoreSettings.getPushOrDeployOnSaveEnabled() &&
        !(await ignorePath(documentUri.fsPath))
      ) {
        await DeployQueue.get().enqueue(documentUri);
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

async function ignorePath(documentPath: string) {
  return (
    fileShouldNotBeDeployed(documentPath) ||
    !(await pathIsInPackageDirectory(documentPath))
  );
}

export async function pathIsInPackageDirectory(
  documentPath: string
): Promise<boolean> {
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

export function fileShouldNotBeDeployed(fsPath: string) {
  return isDotFile(fsPath) || isSoql(fsPath) || isAnonApex(fsPath);
}

function isDotFile(fsPath: string) {
  return path.basename(fsPath).startsWith('.');
}

function isSoql(fsPath: string) {
  return path.basename(fsPath).endsWith('.soql');
}

function isAnonApex(fsPath: string) {
  return path.basename(fsPath).endsWith('.apex');
}
