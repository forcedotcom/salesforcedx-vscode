/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer,
  PostconditionChecker
} from '@salesforce/salesforcedx-utils-vscode';
import { ProjectOptions, TemplateType } from '@salesforce/templates';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { InputUtils } from '../util/inputUtils';
import { LibraryBaseTemplateCommand } from './templates/libraryBaseTemplateCommand';
import { CompositeParametersGatherer, EmptyPreChecker, SfCommandlet } from './util';

export enum projectTemplateEnum {
  standard = 'standard',
  empty = 'empty',
  analytics = 'analytics'
}

type projectGenerateOptions = {
  isProjectWithManifest: boolean;
};

export class ProjectTemplateItem implements vscode.QuickPickItem {
  public label: string;
  public description: string;
  constructor(name: string, description: string) {
    this.label = nls.localize(name);
    this.description = nls.localize(description);
  }
}

export class LibraryProjectGenerateExecutor extends LibraryBaseTemplateCommand<ProjectNameAndPathAndTemplate> {
  private readonly options: projectGenerateOptions;

  public constructor(options = { isProjectWithManifest: false }) {
    super();
    this.options = options;
  }

  public executionName = nls.localize('project_generate_text');
  public telemetryName = 'project_generate';
  public templateType = TemplateType.Project;
  public getOutputFileName(data: ProjectNameAndPathAndTemplate) {
    return data.projectName;
  }
  protected async openCreatedTemplateInVSCode(outputdir: string, fileName: string) {
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(path.join(outputdir, fileName)));
  }

  public constructTemplateOptions(data: ProjectNameAndPathAndTemplate) {
    const templateOptions: ProjectOptions = {
      projectname: data.projectName,
      template: data.projectTemplate as ProjectOptions['template'],
      outputdir: data.projectUri,
      ns: '',
      loginurl: 'https://login.salesforce.com',
      defaultpackagedir: 'force-app',
      manifest: this.options.isProjectWithManifest
    };
    this.telemetryProperties = { projectTemplate: data.projectTemplate };
    return templateOptions;
  }
}

export type ProjectNameAndPathAndTemplate = ProjectName & ProjectURI & ProjectTemplate;

export type ProjectURI = {
  projectUri: string;
};

export type ProjectName = {
  projectName: string;
};

export type ProjectTemplate = {
  projectTemplate: string;
};

export class SelectProjectTemplate implements ParametersGatherer<ProjectTemplate> {
  private readonly prefillValueProvider?: () => string;

  constructor(prefillValueProvider?: () => string) {
    this.prefillValueProvider = prefillValueProvider;
  }

  public async gather(): Promise<CancelResponse | ContinueResponse<ProjectTemplate>> {
    const items: vscode.QuickPickItem[] = [
      new ProjectTemplateItem('project_generate_standard_template_display_text', 'project_generate_standard_template'),
      new ProjectTemplateItem('project_generate_empty_template_display_text', 'project_generate_empty_template'),
      new ProjectTemplateItem('project_generate_analytics_template_display_text', 'project_generate_analytics_template')
    ];

    const selection = await vscode.window.showQuickPick(items);
    let projectTemplate: string | undefined;
    switch (selection && selection.label) {
      case nls.localize('project_generate_standard_template_display_text'):
        projectTemplate = projectTemplateEnum.standard;
        break;
      case nls.localize('project_generate_empty_template_display_text'):
        projectTemplate = projectTemplateEnum.empty;
        break;
      case nls.localize('project_generate_analytics_template_display_text'):
        projectTemplate = projectTemplateEnum.analytics;
        break;
      default:
        break;
    }
    return projectTemplate ? { type: 'CONTINUE', data: { projectTemplate } } : { type: 'CANCEL' };
  }
}
export class SelectProjectName implements ParametersGatherer<ProjectName> {
  private readonly prefillValueProvider?: () => string;

  constructor(prefillValueProvider?: () => string) {
    this.prefillValueProvider = prefillValueProvider;
  }

  public async gather(): Promise<CancelResponse | ContinueResponse<ProjectName>> {
    const prompt = nls.localize('parameter_gatherer_enter_project_name');
    const prefillValue = this.prefillValueProvider ? this.prefillValueProvider() : '';
    const projectName = await InputUtils.getFormattedString(prompt, prefillValue);
    return projectName ? { type: 'CONTINUE', data: { projectName } } : { type: 'CANCEL' };
  }
}

export class SelectProjectFolder implements ParametersGatherer<ProjectURI> {
  public async gather(): Promise<CancelResponse | ContinueResponse<ProjectURI>> {
    const projectUri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: nls.localize('project_generate_open_dialog_create_label')
    } as vscode.OpenDialogOptions);
    return projectUri && projectUri.length === 1
      ? { type: 'CONTINUE', data: { projectUri: projectUri[0].fsPath } }
      : { type: 'CANCEL' };
  }
}

export class PathExistsChecker implements PostconditionChecker<ProjectNameAndPathAndTemplate> {
  public async check(
    inputs: ContinueResponse<ProjectNameAndPathAndTemplate> | CancelResponse
  ): Promise<ContinueResponse<ProjectNameAndPathAndTemplate> | CancelResponse> {
    if (inputs.type === 'CONTINUE') {
      const pathExists = fs.existsSync(path.join(inputs.data.projectUri, `${inputs.data.projectName}/`));
      if (!pathExists) {
        return inputs;
      } else {
        const overwrite = await notificationService.showWarningMessage(
          nls.localize('warning_prompt_dir_overwrite'),
          nls.localize('warning_prompt_overwrite'),
          nls.localize('warning_prompt_overwrite_cancel')
        );
        if (overwrite === nls.localize('warning_prompt_overwrite')) {
          return inputs;
        }
      }
    }
    return { type: 'CANCEL' };
  }
}

const workspaceChecker = new EmptyPreChecker();
const parameterGatherer = new CompositeParametersGatherer(
  new SelectProjectTemplate(),
  new SelectProjectName(),
  new SelectProjectFolder()
);
const pathExistsChecker = new PathExistsChecker();

export const sfProjectGenerate = async () => {
  const createTemplateExecutor = new LibraryProjectGenerateExecutor();
  const sfProjectGenerateCommandlet = new SfCommandlet(
    workspaceChecker,
    parameterGatherer,
    createTemplateExecutor,
    pathExistsChecker
  );
  await sfProjectGenerateCommandlet.run();
};

export const projectGenerateWithManifest = async (): Promise<void> => {
  const createTemplateExecutor = new LibraryProjectGenerateExecutor({
    isProjectWithManifest: true
  });
  const projectGenerateWithManifestCommandlet = new SfCommandlet(
    workspaceChecker,
    parameterGatherer,
    createTemplateExecutor,
    pathExistsChecker
  );
  await projectGenerateWithManifestCommandlet.run();
};
