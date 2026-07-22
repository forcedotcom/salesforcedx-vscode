/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { type ProjectOptions } from 'salesforcedx-vscode-services';
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

type TemplateCategory = 'direct' | 'internal' | 'external';

type TemplateCategoryItem = vscode.QuickPickItem & {
  readonly category: TemplateCategory;
  readonly projectTemplate?: ProjectTemplate;
};

const templateCategoryItems: readonly TemplateCategoryItem[] = [
  {
    label: nls.localize('project_generate_standard_template_display_text'),
    description: nls.localize('project_generate_standard_template'),
    category: 'direct',
    projectTemplate: 'standard'
  },
  {
    label: nls.localize('project_generate_empty_template_display_text'),
    description: nls.localize('project_generate_empty_template'),
    category: 'direct',
    projectTemplate: 'empty'
  },
  {
    label: nls.localize('project_generate_analytics_template_display_text'),
    description: nls.localize('project_generate_analytics_template'),
    category: 'direct',
    projectTemplate: 'analytics'
  },
  {
    label: nls.localize('project_generate_internal_app_template_display_text'),
    description: nls.localize('project_generate_internal_app_template'),
    category: 'internal'
  },
  {
    label: nls.localize('project_generate_external_app_template_display_text'),
    description: nls.localize('project_generate_external_app_template'),
    category: 'external'
  },
  {
    label: nls.localize('project_generate_agent_template_display_text'),
    description: nls.localize('project_generate_agent_template'),
    category: 'direct',
    projectTemplate: 'agent'
  }
];

type FrameworkItem = vscode.QuickPickItem & {
  readonly projectTemplate: ProjectTemplate;
};

const frameworkItems: Record<'internal' | 'external', readonly FrameworkItem[]> = {
  internal: [
    {
      label: nls.localize('project_generate_react_framework_display_text'),
      description: nls.localize('project_generate_react_b2e_template'),
      projectTemplate: 'reactinternalapp'
    },
    {
      label: nls.localize('project_generate_angular_framework_display_text'),
      description: nls.localize('project_generate_angular_b2e_template'),
      projectTemplate: 'angularinternalapp'
    }
  ],
  external: [
    {
      label: nls.localize('project_generate_react_framework_display_text'),
      description: nls.localize('project_generate_react_b2x_template'),
      projectTemplate: 'reactexternalapp'
    },
    {
      label: nls.localize('project_generate_angular_framework_display_text'),
      description: nls.localize('project_generate_angular_b2x_template'),
      projectTemplate: 'angularexternalapp'
    }
  ]
};

const promptForTemplate = Effect.fn('projectGenerate.promptForTemplate')(function* (initialTemplate?: ProjectTemplate) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;

  if (initialTemplate !== undefined) {
    return yield* Effect.succeed(initialTemplate).pipe(Effect.flatMap(promptService.considerUndefinedAsCancellation));
  }

  // Step 1: Pick template category
  const categorySelection = yield* Effect.promise(() =>
    vscode.window.showQuickPick(templateCategoryItems, {
      placeHolder: nls.localize('project_generate_type_placeholder')
    })
  ).pipe(Effect.flatMap(promptService.considerUndefinedAsCancellation));

  // If it's a direct template (standard, empty, analytics, agent), return immediately
  if (categorySelection.category === 'direct') {
    return yield* Effect.succeed(categorySelection.projectTemplate).pipe(
      Effect.flatMap(promptService.considerUndefinedAsCancellation)
    );
  }

  // Step 2: Pick framework (React or Angular)
  const items = frameworkItems[categorySelection.category];
  const frameworkSelection = yield* Effect.promise(() =>
    vscode.window.showQuickPick(items, {
      placeHolder: nls.localize('project_generate_framework_placeholder')
    })
  ).pipe(Effect.flatMap(promptService.considerUndefinedAsCancellation));

  return frameworkSelection.projectTemplate;
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
