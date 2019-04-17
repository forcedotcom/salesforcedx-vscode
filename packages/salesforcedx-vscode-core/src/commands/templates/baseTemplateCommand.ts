/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CliCommandExecutor } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  CancelResponse,
  ContinueResponse,
  DirFileNameSelection,
  PostconditionChecker
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import * as vscode from 'vscode';
import { SfdxCommandletExecutor } from '..';
import { channelService } from '../../channels';
import { SelectOutputDir } from '../../commands';
import { nls } from '../../messages';
import { notificationService, ProgressNotification } from '../../notifications';
import { taskViewService } from '../../statuses';
import { getRootWorkspacePath, hasRootWorkspace } from '../../util';

export abstract class BaseTemplateCommand extends SfdxCommandletExecutor<
  DirFileNameSelection
> {
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
      if (data !== undefined && data.toString() === '0' && hasRootWorkspace()) {
        const document = await vscode.workspace.openTextDocument(
          this.getPathToSource(response.data.outputdir, response.data.fileName)
        );
        vscode.window.showTextDocument(document);
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
    return this.sourcePathStrategy.getPathToSource(
      sourceDirectory,
      fileName,
      this.getFileExtension()
    );
  }

  protected abstract sourcePathStrategy: SourcePathStrategy;

  protected abstract getFileExtension(): string;

  protected abstract getDefaultDirectory(): string;
}

export interface SourcePathStrategy {
  getPathToSource(dirPath: string, fileName: string, fileExt: string): string;
}

export class DefaultPathStrategy implements SourcePathStrategy {
  public getPathToSource(
    dirPath: string,
    fileName: string,
    fileExt: string
  ): string {
    return path.join(dirPath, `${fileName}${fileExt}`);
  }
}
export class BundlePathStrategy implements SourcePathStrategy {
  public getPathToSource(
    dirPath: string,
    fileName: string,
    fileExt: string
  ): string {
    const bundleName = fileName;
    return path.join(dirPath, bundleName, `${fileName}${fileExt}`);
  }
}

export class FilePathExistsChecker
  implements PostconditionChecker<DirFileNameSelection> {
  private fileExtensionsToCheck: string[];
  private sourcePathStrategy: SourcePathStrategy;
  private metadataLabel: string;
  public constructor(
    fileExtensionsToCheck: string[],
    sourcePathStrategy: SourcePathStrategy,
    metadataLabel: string
  ) {
    this.fileExtensionsToCheck = fileExtensionsToCheck;
    this.sourcePathStrategy = sourcePathStrategy;
    this.metadataLabel = metadataLabel;
  }

  public async check(
    inputs: ContinueResponse<DirFileNameSelection> | CancelResponse
  ): Promise<ContinueResponse<DirFileNameSelection> | CancelResponse> {
    if (inputs.type === 'CONTINUE') {
      const outputDir = inputs.data.outputdir;
      const fileName = inputs.data.fileName;
      const files = await vscode.workspace.findFiles(
        this.createFilesGlob(outputDir, fileName)
      );
      // If file does not exist then create it, otherwise prompt user to overwrite the file
      if (files.length === 0) {
        return inputs;
      } else {
        const overwrite = await notificationService.showWarningMessage(
          nls.localize('warning_prompt_file_overwrite', this.metadataLabel),
          nls.localize('warning_prompt_overwrite_confirm'),
          nls.localize('warning_prompt_overwrite_cancel')
        );
        if (overwrite === nls.localize('warning_prompt_overwrite_confirm')) {
          return inputs;
        }
      }
    }
    return { type: 'CANCEL' };
  }

  private createFilesGlob(outputDir: string, fileName: string): string {
    const filePaths = this.fileExtensionsToCheck.map(fileExtension =>
      this.sourcePathStrategy.getPathToSource(
        outputDir,
        fileName,
        fileExtension
      )
    );
    return `{${filePaths.join(',')}}`;
  }
}
