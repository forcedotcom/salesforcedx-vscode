/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  TemplateOptions,
  TemplateService,
  TemplateType
} from '@salesforce/templates';
import {
  CommandletExecutor,
  PathStrategyFactory,
  SelectOutputDir,
  SourcePathStrategy
} from '../util';

import { channelService } from '../../channels';
import { notificationService } from '../../notifications';
import { telemetryService } from '../../telemetry';
import {
  getRootWorkspacePath,
  hasRootWorkspace,
  MetadataDictionary,
  MetadataInfo
} from '../../util';

import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';

import * as path from 'path';
import { ProgressLocation, window, workspace } from 'vscode';

interface ExecutionResult {
  output?: string;
  error?: Error;
}

/**
 * Base class for all template commands
 */
export abstract class LibraryBaseTemplateCommand<T>
  implements CommandletExecutor<T> {
  private _metadataType: MetadataInfo | undefined;
  protected showChannelOutput = true;

  /**
   * Command name
   */
  public abstract get executionName(): string;
  /**
   * Command telemetry name
   */
  public abstract get telemetryName(): string;
  /**
   * Template type
   */
  public abstract get templateType(): TemplateType;
  /**
   * Construct template creation options from user input
   * @param data data from Continue response
   */
  public abstract constructTemplateOptions(data: T): TemplateOptions;

  public async execute(response: ContinueResponse<T>): Promise<void> {
    const startTime = process.hrtime();
    const commandName = this.executionName;
    channelService.showCommandWithTimestamp(`Starting ${commandName}`);
    const result: ExecutionResult = await window.withProgress(
      {
        title: commandName,
        location: ProgressLocation.Notification
      },
      async () => {
        try {
          const templateOptions = this.constructTemplateOptions(response.data);
          const libraryResult = await this.createTemplate(
            this.templateType,
            templateOptions
          );
          const fileName = this.getOutputFileName(response.data);
          telemetryService.sendCommandEvent(this.telemetryName, startTime, {
            dirType: this.identifyDirType(libraryResult.outputDir),
            commandExecutor: 'library'
          });
          await this.openCreatedTemplateInVSCode(
            libraryResult.outputDir,
            fileName
          );
          return {
            output: libraryResult.rawOutput
          };
        } catch (error) {
          telemetryService.sendException(
            'force_template_create_library',
            error.message
          );
          return {
            error
          };
        }
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
      channelService.appendLine(result.error.message);
      notificationService.showFailedExecution(commandName);
    }
  }

  private async createTemplate(
    templateType: TemplateType,
    templateOptions: TemplateOptions
  ) {
    const cwd = getRootWorkspacePath();
    const templateService = TemplateService.getInstance(cwd);
    return await templateService.create(templateType, templateOptions);
  }

  protected async openCreatedTemplateInVSCode(
    outputdir: string,
    fileName: string
  ) {
    if (hasRootWorkspace()) {
      const document = await workspace.openTextDocument(
        this.getPathToSource(outputdir, fileName)
      );
      window.showTextDocument(document);
    }
  }

  /**
   * Specify one of the metadata types from one of metadataTypeConstants.
   * if this is not specified, you should override openCreatedTemplateInVSCode
   * or getSourcePathStrategy/getFileExtension/getDefaultDirectory.
   */
  public metadataTypeName: string = '';
  /**
   * Locate output file name from user input.
   * We use this function to determine the file name to open,
   * after template creation completes.
   * @param data data from ContinueResponse
   */
  public abstract getOutputFileName(data: T): string;

  private get metadataType(): MetadataInfo | undefined {
    if (this._metadataType) {
      return this._metadataType;
    }
    const type = this.metadataTypeName;
    const info = MetadataDictionary.getInfo(type);
    this._metadataType = info;
    return info;
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
    // outputDir from library is an absolute path
    const sourceDirectory = outputDir;
    return this.getSourcePathStrategy().getPathToSource(
      sourceDirectory,
      fileName,
      this.getFileExtension()
    );
  }

  public getSourcePathStrategy(): SourcePathStrategy {
    if (!this.metadataType) return PathStrategyFactory.createDefaultStrategy();
    return this.metadataType.pathStrategy;
  }

  public getFileExtension(): string {
    if (!this.metadataType) return '';
    return `.${this.metadataType.suffix}`;
  }

  public getDefaultDirectory(): string {
    if (!this.metadataType) return '';
    return this.metadataType.directory;
  }
}
