import {
  TemplateOptions,
  TemplateService,
  TemplateType
} from '@salesforce/templates';
import {
  CommandletExecutor,
  SelectOutputDir,
  SourcePathStrategy
} from '../util';

import { channelService } from '../../channels';
import { notificationService } from '../../notifications';
import {
  getRootWorkspacePath,
  hasRootWorkspace,
  MetadataDictionary,
  MetadataInfo
} from '../../util';

import {
  CancelResponse,
  ContinueResponse,
  DirFileNameSelection,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';

import * as path from 'path';
import { ProgressLocation, window, workspace } from 'vscode';

interface ExecutionResult {
  output?: string;
  error?: Error;
}

function wrapExecute(
  commandName: string,
  telemetryName: string,
  fn: (...args: any[]) => Promise<ExecutionResult>
) {
  return async (...args: any[]) => {
    channelService.showCommandWithTimestamp(`Starting ${commandName}`);
    const result = await window.withProgress(
      {
        title: commandName,
        location: ProgressLocation.Notification
      },
      async () => {
        return await fn.call(null, ...args);
      }
    );
    if (result.output) {
      channelService.appendLine(result.output);
      channelService.showCommandWithTimestamp(`Finished ${commandName}`);
      notificationService.showSuccessfulExecution(commandName).catch(() => {
        // ignore
      });
    }
    if (result.error) {
      notificationService.showFailedExecution(commandName);
    }
  };
}

export abstract class LibraryBaseTemplateCommand<T>
  implements CommandletExecutor<T> {
  private _metadataType: MetadataInfo | undefined;
  protected showChannelOutput = true;
  protected startTime: [number, number] | undefined;

  public abstract get executionName(): string;
  public abstract get telemetryName(): string;
  public abstract get metadataTypeName(): string;
  public abstract get templateType(): TemplateType;
  public abstract constructTemplateOptions(data: T): TemplateOptions;
  public abstract getOutputFileName(data: T): string;

  private get metadataType(): MetadataInfo {
    if (this._metadataType) {
      return this._metadataType;
    }
    const type = this.metadataTypeName;
    const info = MetadataDictionary.getInfo(type);
    if (!info) {
      throw new Error(`Unrecognized metadata type ${type}`);
    }
    this._metadataType = info;
    return info;
  }

  public async execute(response: ContinueResponse<T>): Promise<void> {
    await wrapExecute(this.executionName, this.telemetryName, async () => {
      try {
        const templateOptions = this.constructTemplateOptions(response.data);
        const result = await this.createTemplate(
          this.templateType,
          templateOptions
        );
        const fileName = this.getOutputFileName(response.data);
        await this.openCreatedDocument(result.outputDir, fileName);
        return {
          output: result.rawOutput
        };
      } catch (error) {
        return {
          error
        };
      }
    })();
  }

  private async createTemplate(
    templateType: TemplateType,
    templateOptions: TemplateOptions
  ) {
    const cwd = getRootWorkspacePath();
    const templateService = TemplateService.getInstance(cwd);
    return await templateService.create(templateType, templateOptions);
  }

  private async openCreatedDocument(outputdir: string, fileName: string) {
    if (hasRootWorkspace()) {
      const document = await workspace.openTextDocument(
        this.getPathToSource(outputdir, fileName)
      );
      window.showTextDocument(document);
    }
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

  public getDefaultDirectory(): string {
    return this.metadataType.directory;
  }
}
