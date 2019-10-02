/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer,
  PostconditionChecker
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as fs from 'fs';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService, ProgressNotification } from '../notifications';
import { taskViewService } from '../statuses';
import {
  CompositeParametersGatherer,
  EmptyPreChecker,
  SfdxCommandlet,
  SfdxCommandletExecutor
} from './commands';
import { projectTemplateEnum } from './util/projectTemplateEnum';

type forceProjectCreateOptions = {
  isProjectWithManifest: boolean;
};

export class ProjectTemplateItem implements vscode.QuickPickItem {
  public label: string;
  public description: string;
  constructor(name: string, description: string) {
    this.label = name;
    this.description = nls.localize(description);
  }
}

export class ForceProjectCreateExecutor extends SfdxCommandletExecutor<
  ProjectNameAndPathAndTemplate
> {
  private readonly options: forceProjectCreateOptions;

  public constructor(options = { isProjectWithManifest: false }) {
    super();
    this.options = options;
  }

  public build(data: ProjectNameAndPathAndTemplate): Command {
    const builder = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_project_create_text'))
      .withArg('force:project:create')
      .withFlag('--projectname', data.projectName)
      .withFlag('--outputdir', data.projectUri)
      .withFlag('--template', data.projectTemplate)
      .withLogName('force_project_create');

    if (this.options.isProjectWithManifest) {
      builder.withArg('--manifest');
    }

    return builder.build();
  }

  public execute(
    response: ContinueResponse<ProjectNameAndPathAndTemplate>
  ): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: response.data.projectUri
    }).execute(cancellationToken);

    execution.processExitSubject.subscribe(async data => {
      this.logMetric(execution.command.logName, startTime);
      if (data !== undefined && data.toString() === '0') {
        await vscode.commands.executeCommand(
          'vscode.openFolder',
          vscode.Uri.file(
            path.join(response.data.projectUri, response.data.projectName)
          )
        );
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
    const items: vscode.QuickPickItem[] = [
      new ProjectTemplateItem(
        projectTemplateEnum.standard,
        'force_project_create_standard_template'
      ),
      new ProjectTemplateItem(
        projectTemplateEnum.empty,
        'force_project_create_empty_template'
      ),
      new ProjectTemplateItem(
        projectTemplateEnum.analytics,
        'force_project_create_analytics_template'
      )
    ];

    const selection = await vscode.window.showQuickPick(items);
    const projectTemplate = selection
      ? selection.label
      : projectTemplateEnum.standard;
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
    const projectNameInputOptions = {
      prompt: nls.localize('parameter_gatherer_enter_project_name')
    } as vscode.InputBoxOptions;
    if (this.prefillValueProvider) {
      projectNameInputOptions.value = this.prefillValueProvider();
    }
    const projectName = await vscode.window.showInputBox(
      projectNameInputOptions
    );
    return projectName
      ? { type: 'CONTINUE', data: { projectName } }
      : { type: 'CANCEL' };
  }
}

export class SelectProjectFolder implements ParametersGatherer<ProjectURI> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<ProjectURI>
  > {
    const projectUri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: nls.localize('force_project_create_open_dialog_create_label')
    } as vscode.OpenDialogOptions);
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
    if (inputs.type === 'CONTINUE') {
      const pathExists = fs.existsSync(
        path.join(inputs.data.projectUri, `${inputs.data.projectName}/`)
      );
      if (!pathExists) {
        return inputs;
      } else {
        const overwrite = await notificationService.showWarningMessage(
          nls.localize('warning_prompt_dir_overwrite'),
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
}

const workspaceChecker = new EmptyPreChecker();
const parameterGatherer = new CompositeParametersGatherer(
  new SelectProjectTemplate(),
  new SelectProjectName(),
  new SelectProjectFolder()
);
const pathExistsChecker = new PathExistsChecker();

const sfdxProjectCreateCommandlet = new SfdxCommandlet(
  workspaceChecker,
  parameterGatherer,
  new ForceProjectCreateExecutor(),
  pathExistsChecker
);
export async function forceSfdxProjectCreate() {
  await sfdxProjectCreateCommandlet.run();
}

const projectWithManifestCreateCommandlet = new SfdxCommandlet(
  workspaceChecker,
  parameterGatherer,
  new ForceProjectCreateExecutor({ isProjectWithManifest: true }),
  pathExistsChecker
);
export async function forceProjectWithManifestCreate() {
  await projectWithManifestCreateCommandlet.run();
}
