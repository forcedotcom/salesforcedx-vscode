/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CancelResponse,
  CompositeParametersGatherer,
  ContinueResponse,
  notificationService,
  ParametersGatherer,
  PostconditionChecker,
  SfCommandlet,
  fileOrFolderExists
} from '@salesforce/salesforcedx-utils-vscode';
import { ProjectOptions, TemplateType } from '@salesforce/templates';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { coerceMessageKey, nls } from '../messages';
import { getFormattedString } from '../util/inputUtils';
import { LibraryBaseTemplateCommand } from './templates/libraryBaseTemplateCommand';
import { EmptyPreChecker } from './util';

type ProjectGenerateOptions = {
  isProjectWithManifest: boolean;
};

class ProjectTemplateItem implements vscode.QuickPickItem {
  public label: string;
  public description: string;
  constructor(name: string, description: string) {
    this.label = nls.localize(coerceMessageKey(name));
    this.description = nls.localize(coerceMessageKey(description));
  }
}

class LibraryProjectGenerateExecutor extends LibraryBaseTemplateCommand<ProjectNameAndPathAndTemplate> {
  private readonly options: ProjectGenerateOptions;

  constructor(options = { isProjectWithManifest: false }) {
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
    await vscode.commands.executeCommand('vscode.openFolder', URI.file(path.join(outputdir, fileName)));
  }

  public constructTemplateOptions(data: ProjectNameAndPathAndTemplate) {
    const templateOptions: ProjectOptions = {
      projectname: data.projectName,
      template: data.projectTemplate,
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

type ProjectNameAndPathAndTemplate = ProjectName & ProjectURI & { projectTemplate: ProjectTemplate };

type ProjectURI = {
  projectUri: string;
};

type ProjectName = {
  projectName: string;
};

export type ProjectTemplate = 'standard' | 'empty' | 'analytics' | 'reactb2e' | 'reactb2x' | 'nativemobile' | 'agent';

class SelectProjectTemplate implements ParametersGatherer<{ projectTemplate: ProjectTemplate }> {
  private readonly initialTemplate?: ProjectTemplate;

  constructor(initialTemplate?: ProjectTemplate) {
    this.initialTemplate = initialTemplate;
  }

  public async gather(): Promise<CancelResponse | ContinueResponse<{ projectTemplate: ProjectTemplate }>> {
    if (this.initialTemplate !== undefined) {
      return { type: 'CONTINUE', data: { projectTemplate: this.initialTemplate } };
    }
    const items: vscode.QuickPickItem[] = [
      new ProjectTemplateItem('project_generate_standard_template_display_text', 'project_generate_standard_template'),
      new ProjectTemplateItem('project_generate_empty_template_display_text', 'project_generate_empty_template'),
      new ProjectTemplateItem(
        'project_generate_analytics_template_display_text',
        'project_generate_analytics_template'
      ),
      new ProjectTemplateItem(
        'project_generate_react_b2e_template_display_text',
        'project_generate_react_b2e_template'
      ),
      new ProjectTemplateItem('project_generate_react_b2x_template_display_text', 'project_generate_react_b2x_template')
    ];

    const selection = await vscode.window.showQuickPick(items);
    let projectTemplate: ProjectTemplate | undefined;
    switch (selection?.label) {
      case nls.localize('project_generate_standard_template_display_text'):
        projectTemplate = 'standard';
        break;
      case nls.localize('project_generate_empty_template_display_text'):
        projectTemplate = 'empty';
        break;
      case nls.localize('project_generate_analytics_template_display_text'):
        projectTemplate = 'analytics';
        break;
      case nls.localize('project_generate_react_b2e_template_display_text'):
        projectTemplate = 'reactb2e';
        break;
      case nls.localize('project_generate_react_b2x_template_display_text'):
        projectTemplate = 'reactb2x';
        break;
      default:
        break;
    }
    return projectTemplate ? { type: 'CONTINUE', data: { projectTemplate } } : { type: 'CANCEL' };
  }
}
class SelectProjectName implements ParametersGatherer<ProjectName> {
  private readonly prefillValueProvider?: () => string;
  private readonly initialProjectName?: string;

  constructor(prefillValueProvider?: () => string, initialProjectName?: string) {
    this.prefillValueProvider = prefillValueProvider;
    this.initialProjectName = initialProjectName;
  }

  public async gather(): Promise<CancelResponse | ContinueResponse<ProjectName>> {
    if (this.initialProjectName !== undefined && this.initialProjectName.length > 0) {
      return { type: 'CONTINUE', data: { projectName: this.initialProjectName } };
    }
    const prompt = nls.localize('parameter_gatherer_enter_project_name');
    const prefillValue = this.prefillValueProvider ? this.prefillValueProvider() : '';
    const projectName = await getFormattedString(prompt, prefillValue);
    return projectName ? { type: 'CONTINUE', data: { projectName } } : { type: 'CANCEL' };
  }
}

class SelectProjectFolder implements ParametersGatherer<ProjectURI> {
  private readonly initialProjectUri?: string;

  constructor(initialProjectUri?: string) {
    this.initialProjectUri = initialProjectUri;
  }

  public async gather(): Promise<CancelResponse | ContinueResponse<ProjectURI>> {
    if (this.initialProjectUri !== undefined && this.initialProjectUri.length > 0) {
      return { type: 'CONTINUE', data: { projectUri: this.initialProjectUri } };
    }
    const projectUri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: nls.localize('project_generate_open_dialog_create_label')
    });
    return projectUri?.length === 1
      ? { type: 'CONTINUE', data: { projectUri: projectUri[0].fsPath } }
      : { type: 'CANCEL' };
  }
}

class PathExistsChecker implements PostconditionChecker<ProjectNameAndPathAndTemplate> {
  public async check(
    inputs: ContinueResponse<ProjectNameAndPathAndTemplate> | CancelResponse
  ): Promise<ContinueResponse<ProjectNameAndPathAndTemplate> | CancelResponse> {
    if (inputs.type === 'CONTINUE') {
      if (!(await fileOrFolderExists(path.join(inputs.data.projectUri, `${inputs.data.projectName}/`)))) {
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
const pathExistsChecker = new PathExistsChecker();

/** Optional args when invoking Create Project; when provided, the corresponding prompt is skipped. */
export type ProjectGenerateArgs = {
  projectTemplate?: ProjectTemplate;
  projectName?: string;
  projectUri?: string;
};

const buildParameterGatherer = (args?: ProjectGenerateArgs) =>
  new CompositeParametersGatherer<ProjectNameAndPathAndTemplate>(
    new SelectProjectTemplate(args?.projectTemplate),
    new SelectProjectName(undefined, args?.projectName),
    new SelectProjectFolder(args?.projectUri)
  );

export const sfProjectGenerate = async (args?: ProjectGenerateArgs): Promise<void> => {
  const createTemplateExecutor = new LibraryProjectGenerateExecutor();
  const sfProjectGenerateCommandlet = new SfCommandlet(
    workspaceChecker,
    buildParameterGatherer(args),
    createTemplateExecutor,
    pathExistsChecker
  );
  await sfProjectGenerateCommandlet.run();
};

export const nativemobileProjectGenerate = async (): Promise<void> => {
  await sfProjectGenerate({ projectTemplate: 'nativemobile' });
};

export const agentProjectGenerate = async (): Promise<void> => {
  await sfProjectGenerate({ projectTemplate: 'agent' });
};

export const projectGenerateWithManifest = async (args?: ProjectGenerateArgs): Promise<void> => {
  const createTemplateExecutor = new LibraryProjectGenerateExecutor({
    isProjectWithManifest: true
  });
  const projectGenerateWithManifestCommandlet = new SfCommandlet(
    workspaceChecker,
    buildParameterGatherer(args),
    createTemplateExecutor,
    pathExistsChecker
  );
  await projectGenerateWithManifestCommandlet.run();
};
