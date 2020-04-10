/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  CommandExecution,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as AdmZip from 'adm-zip';
import * as os from 'os';
import * as path from 'path';
import * as shell from 'shelljs';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService, ProgressNotification } from '../notifications';
import { taskViewService } from '../statuses';
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath } from '../util';
import {
  CommonDirDirectoryDiffer,
  DirectoryDiffer,
  DirectoryDiffResults
} from './directoryDiffer';

export interface ConflictDetectionConfig {
  usernameOrAlias: string;
  packageDir: string;
  manifest: string;
}

export class ConflictDetector {
  private differ: DirectoryDiffer;
  private static instance: ConflictDetector;

  constructor(differ?: DirectoryDiffer) {
    this.differ = differ || new CommonDirDirectoryDiffer();
  }

  public static getInstance(): ConflictDetector {
    if (!ConflictDetector.instance) {
      ConflictDetector.instance = new ConflictDetector(
        new CommonDirDirectoryDiffer()
      );
    }
    return ConflictDetector.instance;
  }

  public getCachePath(username: string): string {
    return path.join(os.tmpdir(), '.sfdx', 'tools', 'conflicts', username);
  }

  public buildRetrieveOrgSourceCommand(
    usernameOrAlias: string,
    targetPath: string,
    manifestPath: string
  ): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('conflict_detect_retrieve_org_source'))
      .withArg('force:mdapi:retrieve')
      .withFlag('--retrievetargetdir', targetPath)
      .withFlag('--unpackaged', manifestPath)
      .withFlag('--targetusername', usernameOrAlias)
      .withLogName('conflict_detect_retrieve_org_source')
      .build();
  }

  public buildMetadataApiConvertOrgSourceCommand(
    rootDir: string,
    outputDir: string
  ): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('conflict_detect_convert_org_source'))
      .withArg('force:mdapi:convert')
      .withFlag('--rootdir', rootDir)
      .withFlag('--outputdir', outputDir)
      .withLogName('conflict_detect_convert_org_source')
      .build();
  }

  public clearCache(
    usernameOrAlias: string,
    throwErrorOnFailure: boolean = false
  ): string {
    const cachePath = this.getCachePath(usernameOrAlias);
    this.clearDirectory(cachePath, throwErrorOnFailure);
    return cachePath;
  }

  public async checkForConflicts(
    data: ConflictDetectionConfig
  ): Promise<DirectoryDiffResults> {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    let results;
    try {
      results = await this.checkForConflictsInternal(
        getRootWorkspacePath(),
        data,
        cancellationTokenSource,
        cancellationToken
      );
    } catch (error) {
      this.reportError('conflict_detect_error', error);
      return Promise.reject(error);
    }

    telemetryService.sendCommandEvent('conflict_detect', startTime, {
      conflicts: results.different.size,
      orgFiles: results.scannedRemote,
      localFiles: results.scannedLocal
    });

    return results;
  }

  private async checkForConflictsInternal(
    projectPath: string,
    data: ConflictDetectionConfig,
    cancellationTokenSource: any,
    cancellationToken: any
  ): Promise<DirectoryDiffResults> {
    const tempMetadataPath = this.clearCache(data.usernameOrAlias, true);

    // 1: prep the shadow directory
    const manifestPath = path.join(tempMetadataPath, 'package.xml');
    try {
      shell.mkdir('-p', tempMetadataPath);
      shell.cp(data.manifest, manifestPath);
    } catch (error) {
      this.reportError('error_creating_packagexml', error);
      return Promise.reject();
    }

    // 2: retrieve unmanaged org source to the shadow directory
    await this.executeCommand(
      this.buildRetrieveOrgSourceCommand(
        data.usernameOrAlias,
        tempMetadataPath,
        manifestPath
      ),
      projectPath,
      cancellationTokenSource,
      cancellationToken
    );

    // 3: unzip retrieved source
    const unpackagedZipFile = path.join(tempMetadataPath, 'unpackaged.zip');
    try {
      const zip = new AdmZip(unpackagedZipFile);
      zip.extractAllTo(tempMetadataPath, true);
    } catch (error) {
      this.reportError('error_extracting_org_source', error);
      return Promise.reject();
    }

    // 4: convert org source to decomposed (source) format
    const unconvertedSourcePath = path.join(tempMetadataPath, 'unpackaged');
    const convertedSourcePath = path.join(tempMetadataPath, 'converted');
    await this.executeCommand(
      this.buildMetadataApiConvertOrgSourceCommand(
        unconvertedSourcePath,
        convertedSourcePath
      ),
      projectPath,
      cancellationTokenSource,
      cancellationToken
    );

    // 5: diff project directory (local) and retrieved directory (remote)
    // Assume there are consistent subdirs from each root i.e. 'main/default'
    const localSourcePath: string = path.join(projectPath, data.packageDir);
    const diffs = this.differ.diff(localSourcePath, convertedSourcePath);

    return diffs;
  }

  public async executeCommand(
    command: Command,
    projectPath: string,
    cancellationTokenSource: vscode.CancellationTokenSource,
    cancellationToken: vscode.CancellationToken
  ): Promise<string> {
    const startTime = process.hrtime();
    const execution = new CliCommandExecutor(
      command,
      { cwd: projectPath, env: { SFDX_JSON_TO_STDOUT: 'true' } },
      true
    ).execute(cancellationToken);

    const result = new CommandOutput().getCmdResult(execution);
    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
    execution.processExitSubject.subscribe(() => {
      telemetryService.sendCommandEvent(execution.command.logName, startTime);
    });
    return result;
  }

  protected attachExecution(
    execution: CommandExecution,
    cancellationTokenSource: vscode.CancellationTokenSource,
    cancellationToken: vscode.CancellationToken
  ) {
    channelService.streamCommandOutput(execution);
    channelService.showChannelOutput();
    notificationService.reportCommandExecutionStatus(
      execution,
      cancellationToken
    );
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }

  private clearDirectory(dirToRemove: string, throwErrorOnFailure: boolean) {
    try {
      shell.rm('-rf', dirToRemove);
    } catch (error) {
      this.reportError('error_cleanup_temp_files', error);
      if (throwErrorOnFailure) {
        throw error;
      }
    }
  }

  private reportError(messageKey: string, error: Error) {
    console.error(error);
    const errorMsg = nls.localize(messageKey, error.toString());
    channelService.appendLine(errorMsg);
    notificationService.showErrorMessage(errorMsg);
    telemetryService.sendException('ConflictDetectionException', errorMsg);
  }
}
