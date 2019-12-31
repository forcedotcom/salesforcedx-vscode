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
import { getRootWorkspacePath, hasRootWorkspace } from '../../util';
import {
  MetadataDictionary,
  MetadataInfo
} from '../../util/metadataDictionary';
import { SelectOutputDir, SfdxCommandletExecutor } from '../util';
import { SourcePathStrategy } from '../util';

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

  public getPathToSource(outputDir: string, fileName: string): string {
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

  public getDefaultDirectory(): string {
    return this.metadataType.directory;
  }
}
