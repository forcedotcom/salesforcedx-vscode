/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ConfigUtil,
  ContinueResponse,
  notificationService,
  workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';
import { TemplateOptions, TemplateService, TemplateType } from '@salesforce/templates';
import type { Properties } from '@salesforce/vscode-service-provider';
import { ProgressLocation, window } from 'vscode';
import { channelService } from '../../channels';
import { telemetryService } from '../../telemetry';
import { CommandletExecutor } from '../util';

type ExecutionResult = {
  output?: string;
  error?: Error;
};

/**
 * Base class for all template commands
 */
export abstract class LibraryBaseTemplateCommand<T> implements CommandletExecutor<T> {
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

  /**
   * Open the file/folder produced by the template after creation.
   */
  protected abstract openCreatedTemplateInVSCode(outputdir: string, fileName: string): Promise<void>;

  /**
   * Locate output file name from user input.
   * We use this function to determine the file name to open,
   * after template creation completes.
   * @param data data from ContinueResponse
   */
  public abstract getOutputFileName(data: T): string;

  /**
   * Additional telemetry properties to log on successful execution
   */
  protected telemetryProperties: Properties = {};

  public async execute(response: ContinueResponse<T>): Promise<void> {
    const startTime = globalThis.performance.now();
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
          const libraryResult = await this.createTemplate(this.templateType, templateOptions);
          const fileName = this.getOutputFileName(response.data);
          telemetryService.sendCommandEvent(this.telemetryName, startTime, {
            commandExecutor: 'library',
            ...this.telemetryProperties
          });
          await this.openCreatedTemplateInVSCode(libraryResult.outputDir, fileName);
          return {
            output: libraryResult.rawOutput
          };
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error(String(error));
          telemetryService.sendException('template_create_library', err.message);
          return {
            error: err
          };
        }
      }
    );
    if (result.output) {
      channelService.appendLine(result.output);
      channelService.showCommandWithTimestamp(`Finished ${commandName}`);
      notificationService.showSuccessfulExecution(commandName, channelService).catch(() => {
        // ignore
      });
    }
    if (result.error) {
      const msg = result.error instanceof Error ? result.error.message : String(result.error);
      channelService.appendLine(msg);
      notificationService.showFailedExecution(commandName, channelService);
    }
  }

  private async createTemplate(templateType: TemplateType, templateOptions: TemplateOptions) {
    const cwd = workspaceUtils.getRootWorkspacePath();
    const templateService = TemplateService.getInstance(cwd);

    const configValue = await ConfigUtil.getTemplatesDirectory();
    const customOrgMetadataTemplates = configValue === undefined ? undefined : String(configValue);

    this.telemetryProperties.isUsingCustomOrgMetadataTemplates = String(customOrgMetadataTemplates !== undefined);

    return await templateService.create(templateType, templateOptions, customOrgMetadataTemplates);
  }
}
