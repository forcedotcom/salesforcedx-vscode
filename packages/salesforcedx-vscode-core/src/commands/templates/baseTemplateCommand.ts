/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CliCommandExecutor } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  ContinueResponse,
  LocalComponent
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import * as vscode from 'vscode';
import { SfdxCommandletExecutor } from '..';
import { channelService } from '../../channels';
import { SelectOutputDir } from '../../commands';
import { notificationService, ProgressNotification } from '../../notifications';
import { taskViewService } from '../../statuses';
import { getRootWorkspacePath, hasRootWorkspace } from '../../util';
import { SourcePathStrategy } from '../util';

export abstract class BaseTemplateCommand extends SfdxCommandletExecutor<
  LocalComponent
> {
  public execute(response: ContinueResponse<LocalComponent>): void {
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
