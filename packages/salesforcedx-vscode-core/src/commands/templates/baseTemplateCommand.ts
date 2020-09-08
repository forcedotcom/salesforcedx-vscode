/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CliCommandExecutor } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  ContinueResponse,
  DirFileNameSelection
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import * as vscode from 'vscode';
import { channelService } from '../../channels';
import { notificationService, ProgressNotification } from '../../notifications';
import { taskViewService } from '../../statuses';
import {
  getRootWorkspacePath,
  hasRootWorkspace,
  MetadataDictionary,
  MetadataInfo
} from '../../util';
import {
  SelectOutputDir,
  SfdxCommandletExecutor,
  SourcePathStrategy
} from '../util';

export abstract class BaseTemplateCommand extends SfdxCommandletExecutor<
  DirFileNameSelection
  > {
  private metadataType: MetadataInfo;

  constructor(type: string) {
    super();
    const info = MetadataDictionary.getInfo(type);
    if (!info) {
      throw new Error(`Unrecognized metadata type ${type}`);
    }
    this.metadataType = info;
  }

  public execute(response: ContinueResponse<DirFileNameSelection>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: getRootWorkspacePath()
    }).execute(cancellationToken);

    execution.processExitSubject.subscribe(async data => {
      this.logMetric(execution.command.logName, startTime, {
        dirType: this.identifyDirType(response.data.outputdir)
      });
      if (data !== undefined && String(data) === '0' && hasRootWorkspace()) {
        const outputFile = this.getPathToSource(response.data.outputdir, response.data.fileName);
        const document = await vscode.workspace.openTextDocument(
          outputFile
        );
        vscode.window.showTextDocument(document);
        this.runPostCommandTasks(path.dirname(outputFile));
      }
    });

    notificationService.reportExecutionError(
      execution.command.toString(),
      (execution.stderrSubject as any) as Observable<Error | undefined>
    );
    channelService.streamCommandOutput(execution);
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }

  protected runPostCommandTasks(targetDir: string) {
    // By default do nothing
    // This method is overridden in child classes to run any post command tasks
    // Currently only Functions uses this to run "npm install"
  }

  private identifyDirType(outputDirectory: string): string {
    const defaultDirectoryPath = path.join(
      SelectOutputDir.defaultOutput,
      this.getDefaultDirectory()
    );
    return outputDirectory.endsWith(defaultDirectoryPath)
      ? 'defaultDir'
      : 'customDir';
  }

  private getPathToSource(outputDir: string, fileName: string): string {
    const sourceDirectory = path.join(getRootWorkspacePath(), outputDir);
    return this.getSourcePathStrategy().getPathToSource(
      sourceDirectory,
      fileName,
      this.getFileExtension()
    );
  }

  public getSourcePathStrategy(): SourcePathStrategy {
    return this.metadataType.pathStrategy;
  }

  public getFileExtension(): string {
    return `.${this.metadataType.suffix}`;
  }

  public setFileExtension(extension: string): void {
    this.metadataType.suffix = extension;
  }

  public getDefaultDirectory(): string {
    return this.metadataType.directory;
  }
}
