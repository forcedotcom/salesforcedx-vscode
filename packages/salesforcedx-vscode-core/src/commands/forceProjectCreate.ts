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
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { InputUtils } from '../util/inputUtils';
import { LibraryBaseTemplateCommand } from './templates/libraryBaseTemplateCommand';
import {
  CompositeParametersGatherer,
  EmptyPreChecker,
  SfdxCommandlet
} from './util';

export enum projectTemplateEnum {
  standard = 'standard',
  empty = 'empty',
  analytics = 'analytics'
}

type forceProjectCreateOptions = {
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

export class LibraryForceProjectCreateExecutor extends LibraryBaseTemplateCommand<
  ProjectNameAndPathAndTemplate
> {
  private readonly options: forceProjectCreateOptions;

  public constructor(options = { isProjectWithManifest: false }) {
    super();
    this.options = options;
  }

  public executionName = nls.localize('force_project_create_text');
  public telemetryName = 'force_project_create';
  public templateType = TemplateType.Project;
  public getOutputFileName(data: ProjectNameAndPathAndTemplate) {
    return data.projectName;
  }
  protected async openCreatedTemplateInVSCode(
    outputdir: string,
    fileName: string
  ) {

    console.log('DEBUG: entering openCreatedTemplateInVSCode()');
    channelService.appendLine('DEBUG: entering openCreatedTemplateInVSCode()');

    await vscode.commands.executeCommand(
      'vscode.openFolder',
      vscode.Uri.file(path.join(outputdir, fileName))
    );

    console.log('DEBUG: leaving openCreatedTemplateInVSCode()');
    channelService.appendLine('DEBUG: leaving openCreatedTemplateInVSCode()');
  }

  public constructTemplateOptions(data: ProjectNameAndPathAndTemplate) {

    console.log('DEBUG: entering constructTemplateOptions()');
    channelService.appendLine('DEBUG: entering constructTemplateOptions()');

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

    console.log('DEBUG: leaving constructTemplateOptions()');
    channelService.appendLine('DEBUG: leaving constructTemplateOptions()');

    return templateOptions;
  }
}

export type ProjectNameAndPathAndTemplate = ProjectName &
  ProjectURI &
  ProjectTemplate;

export interface ProjectURI {
  projectUri: string;
}

export interface ProjectName {
  projectName: string;
}

export interface ProjectTemplate {
  projectTemplate: string;
}

export class SelectProjectTemplate
  implements ParametersGatherer<ProjectTemplate> {
  private readonly prefillValueProvider?: () => string;

  constructor(prefillValueProvider?: () => string) {
    this.prefillValueProvider = prefillValueProvider;
  }

  public async gather(): Promise<
    CancelResponse | ContinueResponse<ProjectTemplate>
  > {

    console.log('DEBUG: entering SelectProjectTemplate.gather()');
    channelService.appendLine('DEBUG: entering SelectProjectTemplate.gather()');

    const items: vscode.QuickPickItem[] = [
      new ProjectTemplateItem(
        'force_project_create_standard_template_display_text',
        'force_project_create_standard_template'
      ),
      new ProjectTemplateItem(
        'force_project_create_empty_template_display_text',
        'force_project_create_empty_template'
      ),
      new ProjectTemplateItem(
        'force_project_create_analytics_template_display_text',
        'force_project_create_analytics_template'
      )
    ];

    console.log('DEBUG: in SelectProjectTemplate.gather(), about to call vscode.window.showQuickPick()');
    channelService.appendLine('DEBUG: in SelectProjectTemplate.gather(), about to call vscode.window.showQuickPick()');

    const selection = await vscode.window.showQuickPick(items);

    console.log('DEBUG: in SelectProjectTemplate.gather(), finished calling vscode.window.showQuickPick()');
    channelService.appendLine('DEBUG: in SelectProjectTemplate.gather(), finished calling vscode.window.showQuickPick()');

    if (!selection) {
      console.log('DEBUG: ERROR! in SelectProjectTemplate.gather(), showQuickPick() returned no selection');
      channelService.appendLine('DEBUG: ERROR! in SelectProjectTemplate.gather(), showQuickPick() returned no selection');
    } else {
      console.log(`DEBUG: in SelectProjectTemplate.gather(), selection.label: ${selection.label}`);
      channelService.appendLine(`DEBUG: in SelectProjectTemplate.gather(), selection.label: ${selection.label}`);
    }

    let projectTemplate: string | undefined;
    switch (selection && selection.label) {
      case nls.localize('force_project_create_standard_template_display_text'):
        projectTemplate = projectTemplateEnum.standard;
        console.log(`DEBUG: in SelectProjectTemplate.gather(), projectTemplate: ${projectTemplate}`);
        channelService.appendLine(`DEBUG: in SelectProjectTemplate.gather(), projectTemplate: ${projectTemplate}`);
        break;
      case nls.localize('force_project_create_empty_template_display_text'):
        projectTemplate = projectTemplateEnum.empty;
        console.log(`DEBUG: in SelectProjectTemplate.gather(), projectTemplate: ${projectTemplate}`);
        channelService.appendLine(`DEBUG: in SelectProjectTemplate.gather(), projectTemplate: ${projectTemplate}`);
        break;
      case nls.localize('force_project_create_analytics_template_display_text'):
        projectTemplate = projectTemplateEnum.analytics;
        console.log(`DEBUG: in SelectProjectTemplate.gather(), projectTemplate: ${projectTemplate}`);
        channelService.appendLine(`DEBUG: in SelectProjectTemplate.gather(), projectTemplate: ${projectTemplate}`);
        break;
      default:
        // What???
        console.log('DEBUG: ERROR! in SelectProjectTemplate.gather(), unknown selection type');
        channelService.appendLine('DEBUG: ERROR! in SelectProjectTemplate.gather(), unknown selection type');
        console.log(`DEBUG: ERROR! in SelectProjectTemplate.gather(), selection.label: ${selection!.label}`);
        channelService.appendLine(`DEBUG: ERROR! in SelectProjectTemplate.gather(), selection.label: ${selection!.label}`);
        break;
    }

    console.log('DEBUG: leaving SelectProjectTemplate.gather()');
    channelService.appendLine('DEBUG: leaving SelectProjectTemplate.gather()');

    return projectTemplate
      ? { type: 'CONTINUE', data: { projectTemplate } }
      : { type: 'CANCEL' };
  }
}

export class SelectProjectName implements ParametersGatherer<ProjectName> {
  private readonly prefillValueProvider?: () => string;

  constructor(prefillValueProvider?: () => string) {
    this.prefillValueProvider = prefillValueProvider;
  }

  public async gather(): Promise<
    CancelResponse | ContinueResponse<ProjectName>
  > {
    console.log('DEBUG: entering SelectProjectName.gather()');
    channelService.appendLine('DEBUG: entering SelectProjectName.gather()');

    const prompt = nls.localize('parameter_gatherer_enter_project_name');
    const prefillValue = this.prefillValueProvider
      ? this.prefillValueProvider()
      : '';
    const projectName = await InputUtils.getFormattedString(
      prompt,
      prefillValue
    );

    console.log('DEBUG: leaving SelectProjectName.gather()');
    channelService.appendLine('DEBUG: leaving SelectProjectName.gather()');

    return projectName
      ? { type: 'CONTINUE', data: { projectName } }
      : { type: 'CANCEL' };
  }
}

export class SelectProjectFolder implements ParametersGatherer<ProjectURI> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<ProjectURI>
  > {

    console.log('DEBUG: entering SelectProjectFolder.gather()');
    channelService.appendLine('DEBUG: entering SelectProjectFolder.gather()');

    const projectUri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: nls.localize('force_project_create_open_dialog_create_label')
    } as vscode.OpenDialogOptions);

    console.log('DEBUG: leaving SelectProjectFolder.gather()');
    channelService.appendLine('DEBUG: leaving SelectProjectFolder.gather()');

    return projectUri && projectUri.length === 1
      ? { type: 'CONTINUE', data: { projectUri: projectUri[0].fsPath } }
      : { type: 'CANCEL' };
  }
}

export class PathExistsChecker
  implements PostconditionChecker<ProjectNameAndPathAndTemplate> {

  public async check(
    inputs: ContinueResponse<ProjectNameAndPathAndTemplate> | CancelResponse
  ): Promise<ContinueResponse<ProjectNameAndPathAndTemplate> | CancelResponse> {

    console.log('DEBUG: entering PathExistsChecker.check()');
    channelService.appendLine('DEBUG: entering PathExistsChecker.check()');

    if (inputs.type === 'CONTINUE') {
      const pathExists = fs.existsSync(
        path.join(inputs.data.projectUri, `${inputs.data.projectName}/`)
      );

      if (!pathExists) {
        console.log('DEBUG: leaving PathExistsChecker.check(ver1)');
        channelService.appendLine('DEBUG: leaving PathExistsChecker.check(ver1)');

        return inputs;
      } else {
        const overwrite = await notificationService.showWarningMessage(
          nls.localize('warning_prompt_dir_overwrite'),
          nls.localize('warning_prompt_overwrite'),
          nls.localize('warning_prompt_overwrite_cancel')
        );

        if (overwrite === nls.localize('warning_prompt_overwrite')) {
          console.log('DEBUG: leaving PathExistsChecker.check(ver2)');
          channelService.appendLine('DEBUG: leaving PathExistsChecker.check(ver2)');

          return inputs;
        }
      }
    }

    console.log('DEBUG: leaving PathExistsChecker.check(ver3)');
    channelService.appendLine('DEBUG: leaving PathExistsChecker.check(ver3)');

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

export async function forceSfdxProjectCreate() {

  // This is what gets called when "SFDX: Create Project" is called.
  console.log('DEBUG: entering forceSfdxProjectCreate()');
  channelService.showChannelOutput();
  channelService.appendLine('DEBUG: entering forceSfdxProjectCreate()');

  const createTemplateExecutor = new LibraryForceProjectCreateExecutor();
  const sfdxProjectCreateCommandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    createTemplateExecutor,
    pathExistsChecker
  );
  await sfdxProjectCreateCommandlet.run();

  console.log('DEBUG: leaving forceSfdxProjectCreate()');
  channelService.appendLine('DEBUG: leaving forceSfdxProjectCreate()');
}

export async function forceProjectWithManifestCreate() {
  const createTemplateExecutor = new LibraryForceProjectCreateExecutor({
    isProjectWithManifest: true
  });
  const projectWithManifestCreateCommandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    createTemplateExecutor,
    pathExistsChecker
  );
  await projectWithManifestCreateCommandlet.run();
}
