/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as SfTemplates from '@salesforce/templates';
import * as Arr from 'effect/Array';
import * as Effect from 'effect/Effect';
import { isNotUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../messages';

type ProjectTemplate = SfTemplates.ProjectTemplate;

const NonEmptyTrimmedString = Schema.String.check(Schema.isPattern(/\S/));
const isNonEmptyTrimmedString = (value: string | undefined): value is string =>
  isNotUndefined(value) && Schema.is(NonEmptyTrimmedString)(value.trim());

type ProjectGenerateArgs = {
  readonly projectTemplate?: ProjectTemplate;
  readonly projectName?: string;
  readonly projectUri?: string;
  readonly manifest?: boolean;
};

type ProjectTemplateItem = vscode.QuickPickItem & {
  readonly projectTemplate: ProjectTemplate;
};

type TemplateGroup = 'general' | 'internalApps' | 'externalApps' | 'other';

type TemplatePresentation = {
  readonly label: string;
  readonly detail?: string;
  readonly group: TemplateGroup;
};

/** Display text for known templates. Templates missing here still appear, under "Other" with their raw name. */
const TEMPLATE_PRESENTATION: Partial<Record<ProjectTemplate, TemplatePresentation>> = {
  standard: { label: nls.localize('project_generate_standard_template_display_text'), group: 'general' },
  empty: { label: nls.localize('project_generate_empty_template_display_text'), group: 'general' },
  analytics: { label: nls.localize('project_generate_analytics_template_display_text'), group: 'general' },
  agent: { label: nls.localize('project_generate_agent_template_display_text'), group: 'general' },
  reactinternalapp: {
    label: nls.localize('project_generate_react_internal_app_display_text'),
    detail: nls.localize('project_generate_react_b2e_template'),
    group: 'internalApps'
  },
  angularinternalapp: {
    label: nls.localize('project_generate_angular_internal_app_display_text'),
    detail: nls.localize('project_generate_angular_b2e_template'),
    group: 'internalApps'
  },
  vueinternalapp: {
    label: nls.localize('project_generate_vue_internal_app_display_text'),
    detail: nls.localize('project_generate_vue_b2e_template'),
    group: 'internalApps'
  },
  reactexternalapp: {
    label: nls.localize('project_generate_react_external_app_display_text'),
    detail: nls.localize('project_generate_react_b2x_template'),
    group: 'externalApps'
  },
  angularexternalapp: {
    label: nls.localize('project_generate_angular_external_app_display_text'),
    detail: nls.localize('project_generate_angular_b2x_template'),
    group: 'externalApps'
  }
};

/** Templates offered through their own command instead of the Create Project picker. */
const EXCLUDED_TEMPLATES: ReadonlySet<ProjectTemplate> = new Set(['nativemobile']);

const GROUP_ORDER: readonly TemplateGroup[] = ['general', 'internalApps', 'externalApps', 'other'];

const GROUP_SEPARATOR_LABELS: Record<Exclude<TemplateGroup, 'general'>, string> = {
  internalApps: nls.localize('project_generate_separator_internal_apps'),
  externalApps: nls.localize('project_generate_separator_external_apps'),
  other: nls.localize('project_generate_separator_other')
};

/** Builds picker items from the templates package's list, grouped and in package order within each group. */
export const buildTemplateItems = (templates: readonly ProjectTemplate[]): vscode.QuickPickItem[] => {
  const items = templates
    .filter(template => !EXCLUDED_TEMPLATES.has(template))
    .map(template => {
      const presentation = TEMPLATE_PRESENTATION[template];
      const item: ProjectTemplateItem = {
        label: presentation?.label ?? template,
        ...(presentation?.detail ? { detail: presentation.detail } : {}),
        projectTemplate: template
      };
      return { group: presentation?.group ?? 'other', item };
    });
  return GROUP_ORDER.flatMap(group => {
    const groupItems = items.filter(entry => entry.group === group).map(entry => entry.item);
    return groupItems.length === 0 || group === 'general'
      ? groupItems
      : [{ label: GROUP_SEPARATOR_LABELS[group], kind: vscode.QuickPickItemKind.Separator }, ...groupItems];
  });
};

const isProjectTemplateItem = (item: vscode.QuickPickItem): item is ProjectTemplateItem => 'projectTemplate' in item;

const promptForTemplate = Effect.fn('projectGenerate.promptForTemplate')(function* (initialTemplate?: ProjectTemplate) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.v2.services.PromptService;
  return yield* (
    isNotUndefined(initialTemplate)
      ? Effect.succeed(initialTemplate)
      : Effect.succeed(SfTemplates.PROJECT_TEMPLATES).pipe(
          Effect.map(buildTemplateItems),
          Effect.flatMap(items => Effect.promise(() => vscode.window.showQuickPick(items))),
          Effect.map(selection =>
            selection && isProjectTemplateItem(selection) ? selection.projectTemplate : undefined
          )
        )
  ).pipe(Effect.flatMap(promptService.considerUndefinedAsCancellation));
});

const promptForProjectName = Effect.fn('projectGenerate.promptForProjectName')(function* (initialProjectName?: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.v2.services.PromptService;
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
  const promptService = yield* api.v2.services.PromptService;
  return yield* isNonEmptyTrimmedString(initialProjectUri)
    ? Effect.succeed(URI.file(initialProjectUri))
    : Effect.promise(() =>
        vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          openLabel: nls.localize('project_generate_open_dialog_create_label')
        })
      ).pipe(Effect.flatMap(promptService.considerEmptySelectionAsCancellation), Effect.map(Arr.headNonEmpty));
});

export const sfProjectGenerateCommand = Effect.fn('sfProjectGenerateCommand')(function* (
  args: ProjectGenerateArgs | undefined
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fsService = yield* api.v2.services.FsService;
  const promptService = yield* api.v2.services.PromptService;

  const projectTemplate = yield* promptForTemplate(args?.projectTemplate);
  const projectName = yield* promptForProjectName(args?.projectName);
  const parentUri = yield* promptForParentFolder(args?.projectUri);
  const projectDirUri = Utils.joinPath(parentUri, projectName);
  const cwd = yield* fsService.uriToPath(parentUri);

  yield* Effect.annotateCurrentSpan({
    projectTemplate,
    manifest: args?.manifest ?? false
  });

  yield* promptService.ensureMetadataOverwriteOrThrow({ uris: [projectDirUri] });

  yield* api.v2.services.TemplateService.use(service =>
    service.create({
      cwd,
      templateType: api.v2.services.TemplateType.Project,
      options: {
        projectname: projectName,
        template: projectTemplate,
        defaultpackagedir: 'force-app',
        manifest: args?.manifest ?? false
      }
    })
  ).pipe(promptService.withProgress(nls.localize('project_generate_text')));

  return yield* Effect.promise(() => vscode.commands.executeCommand('vscode.openFolder', projectDirUri));
});
