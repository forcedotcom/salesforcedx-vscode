/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ProjectOptions } from '@salesforce/templates';
import * as Effect from 'effect/Effect';
import { isNotUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../messages';

const isNonEmptyTrimmedString = Schema.is(Schema.NonEmptyTrimmedString);

type ProjectTemplate = ProjectOptions['template'];

type ProjectGenerateArgs = {
  readonly projectTemplate?: ProjectTemplate;
  readonly projectName?: string;
  readonly projectUri?: string;
  readonly manifest?: boolean;
};

type ProjectTemplateItem = vscode.QuickPickItem & {
  readonly projectTemplate: ProjectTemplate;
};

type SeparatorItem = vscode.QuickPickItem & { readonly kind: vscode.QuickPickItemKind.Separator };

const templateItems: readonly (ProjectTemplateItem | SeparatorItem)[] = [
  {
    label: nls.localize('project_generate_standard_template_display_text'),
    projectTemplate: 'standard'
  },
  {
    label: nls.localize('project_generate_empty_template_display_text'),
    projectTemplate: 'empty'
  },
  {
    label: nls.localize('project_generate_analytics_template_display_text'),
    projectTemplate: 'analytics'
  },
  {
    label: nls.localize('project_generate_agent_template_display_text'),
    projectTemplate: 'agent'
  },
  { label: nls.localize('project_generate_separator_internal_apps'), kind: vscode.QuickPickItemKind.Separator },
  {
    label: nls.localize('project_generate_react_internal_app_display_text'),
    detail: nls.localize('project_generate_react_b2e_template'),
    projectTemplate: 'reactinternalapp'
  },
  {
    label: nls.localize('project_generate_angular_internal_app_display_text'),
    detail: nls.localize('project_generate_angular_b2e_template'),
    projectTemplate: 'angularinternalapp'
  },
  { label: nls.localize('project_generate_separator_external_apps'), kind: vscode.QuickPickItemKind.Separator },
  {
    label: nls.localize('project_generate_react_external_app_display_text'),
    detail: nls.localize('project_generate_react_b2x_template'),
    projectTemplate: 'reactexternalapp'
  },
  {
    label: nls.localize('project_generate_angular_external_app_display_text'),
    detail: nls.localize('project_generate_angular_b2x_template'),
    projectTemplate: 'angularexternalapp'
  }
];

const isProjectTemplateItem = (item: vscode.QuickPickItem): item is ProjectTemplateItem => 'projectTemplate' in item;

const promptForTemplate = Effect.fn('projectGenerate.promptForTemplate')(function* (initialTemplate?: ProjectTemplate) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  return yield* (
    isNotUndefined(initialTemplate)
      ? Effect.succeed(initialTemplate)
      : Effect.promise(() => vscode.window.showQuickPick(templateItems)).pipe(
          Effect.map(selection =>
            selection && isProjectTemplateItem(selection) ? selection.projectTemplate : undefined
          )
        )
  ).pipe(Effect.flatMap(promptService.considerUndefinedAsCancellation));
});

const promptForProjectName = Effect.fn('projectGenerate.promptForProjectName')(function* (initialProjectName?: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  return yield* (
    isNonEmptyTrimmedString(initialProjectName)
      ? Effect.succeed(initialProjectName)
      : Effect.promise(() =>
          vscode.window.showInputBox({
            prompt: nls.localize('parameter_gatherer_enter_project_name')
          })
        ).pipe(Effect.map(value => value?.trim()))
  ).pipe(Effect.flatMap(promptService.considerUndefinedAsCancellation));
});

const promptForParentFolder = Effect.fn('projectGenerate.promptForParentFolder')(function* (
  initialProjectUri?: string
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  return yield* (
    isNonEmptyTrimmedString(initialProjectUri)
      ? Effect.succeed(URI.file(initialProjectUri))
      : Effect.promise(() =>
          vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: nls.localize('project_generate_open_dialog_create_label')
          })
        ).pipe(Effect.map(selection => selection?.[0]))
  ).pipe(Effect.flatMap(promptService.considerUndefinedAsCancellation));
});

export const sfProjectGenerateCommand = Effect.fn('sfProjectGenerateCommand')(function* (args?: ProjectGenerateArgs) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fsService = yield* api.services.FsService;
  const promptService = yield* api.services.PromptService;

  const projectTemplate = yield* promptForTemplate(args?.projectTemplate);
  const projectName = yield* promptForProjectName(args?.projectName);
  const parentUri = yield* promptForParentFolder(args?.projectUri);
  const projectDirUri = Utils.joinPath(parentUri, projectName);

  yield* Effect.annotateCurrentSpan({
    projectTemplate,
    manifest: args?.manifest ?? false
  });

  yield* promptService.ensureMetadataOverwriteOrThrow({ uris: [projectDirUri] });

  yield* api.services.TemplateService.create({
    cwd: yield* fsService.uriToPath(parentUri),
    templateType: api.services.TemplateType.Project,
    options: {
      projectname: projectName,
      template: projectTemplate,
      defaultpackagedir: 'force-app',
      manifest: args?.manifest ?? false
    }
  }).pipe(promptService.withProgress(nls.localize('project_generate_text')));

  return yield* Effect.promise(() => vscode.commands.executeCommand('vscode.openFolder', projectDirUri));
});
