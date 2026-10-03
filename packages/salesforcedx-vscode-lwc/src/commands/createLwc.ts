/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SfProject } from '@salesforce/core/project';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { AURA_TYPE, LWC_TYPE } from '@salesforce/salesforcedx-lightning-lsp-common';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import * as Option from 'effect/Option';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../messages';
import { promptForLwcName } from './promptForLwcName';

const LWC_TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  default: nls.localize('lwc_template_default_description'),
  typeScript: nls.localize('lwc_template_typescript_description'),
  analyticsDashboard: nls.localize('lwc_template_analytics_dashboard_description'),
  analyticsDashboardWithStep: nls.localize('lwc_template_analytics_dashboard_with_step_description')
};

const CUSTOM_TEMPLATE_FILETYPE = /\.(js|ts)$/;

const promptForTemplate = Effect.fn('promptForLwcTemplate')(function* (
  customTemplateNames: readonly string[],
  configuredTemplate: Option.Option<'default' | 'typeScript'>
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;

  const customItems = customTemplateNames.map(label => ({ label, description: '' }));

  const builtInNames = yield* api.services.TemplateService.getBuiltInTemplateSubdirNames(
    'lightningcomponent',
    'lwc',
    /\.html$/
  );
  // Pin 'default'/'typeScript' first (configuredTemplate leads when set, else 'default' leads): readdirSync order
  // isn't guaranteed, Playwright helpers select the first item, and JS/TS are the two templates users choose
  // between most often.
  const pinnedFirst = Option.getOrElse(configuredTemplate, () => 'default' as const);
  const otherPinnedName = pinnedFirst === 'default' ? 'typeScript' : 'default';
  const pinnedNames = [pinnedFirst, otherPinnedName];
  const pinnedNameSet = new Set(pinnedNames);
  const sortedBuiltInNames = [...pinnedNames, ...builtInNames.filter(n => !pinnedNameSet.has(n))];
  const builtInItems = sortedBuiltInNames.map(label => ({
    label,
    description: LWC_TEMPLATE_DESCRIPTIONS[label] ?? ''
  }));
  const customNameSet = new Set(customTemplateNames);
  const nonOverriddenBuiltInItems = builtInItems.filter(item => !customNameSet.has(item.label));

  // A custom template overriding the explicitly configured template (defaultLwcLanguage) should lead the list
  // (and stay highlighted), rather than falling into the Custom Templates section while the *other* built-in
  // template gets pinned instead. Only applies when defaultLwcLanguage is actually set - otherwise there's no
  // configured preference to honor, and the list falls back to the plain built-in/custom split.
  const preferredOverrideItems: vscode.QuickPickItem[] = Option.match(configuredTemplate, {
    onNone: () => [],
    onSome: preferredTemplate =>
      customNameSet.has(preferredTemplate)
        ? [
            { kind: vscode.QuickPickItemKind.Separator, label: nls.localize('lwc_preferred_template_label') },
            {
              label: preferredTemplate,
              description: nls.localize('lwc_custom_template_override_description', preferredTemplate)
            }
          ]
        : []
  });
  const overriddenPreferredName = Option.filter(configuredTemplate, name => customNameSet.has(name));
  const remainingCustomItems = customItems.filter(
    item => item.label !== Option.getOrUndefined(overriddenPreferredName)
  );

  const remainingCustomSection: vscode.QuickPickItem[] =
    remainingCustomItems.length > 0
      ? [
          { kind: vscode.QuickPickItemKind.Separator, label: nls.localize('lwc_custom_templates_label') },
          ...remainingCustomItems
        ]
      : [];

  const items: vscode.QuickPickItem[] =
    customTemplateNames.length > 0
      ? [
          ...preferredOverrideItems,
          { kind: vscode.QuickPickItemKind.Separator, label: nls.localize('lwc_builtin_templates_label') },
          ...nonOverriddenBuiltInItems,
          ...remainingCustomSection
        ]
      : [...builtInItems];

  return yield* Effect.promise(() =>
    vscode.window.showQuickPick<vscode.QuickPickItem>(items, { placeHolder: nls.localize('template_type_prompt') })
  ).pipe(
    Effect.flatMap(choice => promptService.considerUndefinedAsCancellation(choice)),
    Effect.map(selected => selected.label)
  );
});

/** Determine component template based on priority:
 * 1. sfdx-project.json defaultLwcLanguage (fast path when no custom templates exist to discover)
 * 2. Prompt user (built-in + custom templates), with defaultLwcLanguage still steering which is pinned first */
const determineComponentTemplate = Effect.fn('determineComponentTemplate')(function* (project: SfProject) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const customTemplateNames = yield* api.services.TemplateService.getCustomTemplateSubdirNames(
    'lightningcomponent',
    'lwc',
    CUSTOM_TEMPLATE_FILETYPE
  );

  const projectJson = yield* Effect.tryPromise(() => project.retrieveSfProjectJson());
  // defaultLwcLanguage comes from untrusted sfdx-project.json, so its runtime value may not match the narrowed
  // type - treat anything other than 'typescript'/'javascript' (including invalid values) as unset.
  const preferredTemplate = Match.value(projectJson.get('defaultLwcLanguage')).pipe(
    Match.when('typescript', () => Option.some('typeScript' as const)),
    Match.when('javascript', () => Option.some('default' as const)),
    Match.orElse(() => Option.none<'typeScript' | 'default'>())
  );

  if (customTemplateNames.length === 0 && Option.isSome(preferredTemplate)) {
    return preferredTemplate.value;
  }

  return yield* promptForTemplate(customTemplateNames, preferredTemplate);
});

/** Create LWC via TemplateService from services extension.
 * outputDir: when invoked from explorer context (right-click lwc folder), VS Code passes the folder URI
 * options.internal: passed to the template library.  Used for LWC on Salesforce Core, not for customer use  */
export const createLwcCommand = Effect.fn('createLwcCommand')(function* (
  outputDirParam?: URI,
  options?: { internal?: boolean }
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
  const project = yield* api.services.ProjectService.getSfProject();
  const componentSetService = yield* api.services.ComponentSetService;

  const template = yield* determineComponentTemplate(project);
  const componentName = yield* componentSetService
    .getComponentSetFromProjectDirectories({
      metadataMembers: [
        { type: LWC_TYPE, fullName: '*' },
        { type: AURA_TYPE, fullName: '*' }
      ]
    })
    .pipe(
      Effect.map(set => new Set(Array.from(set.getSourceComponents()).map(c => c.fullName.toLowerCase()))),
      Effect.flatMap(existingNames => promptForLwcName({ existingNames }))
    );

  const outputDirUri =
    outputDirParam ??
    (yield* promptService.promptForOutputDir({
      defaultUri: Utils.joinPath(workspaceInfo.uri, project.getDefaultPackage().path, 'main', 'default', 'lwc'),
      folderName: 'lwc',
      pickerPlaceHolder: nls.localize('lwc_output_dir_prompt')
    }));

  yield* Effect.annotateCurrentSpan({
    componentName,
    outputDir: outputDirUri.toString(),
    template
  });

  yield* promptService.ensureMetadataOverwriteOrThrow({ uris: [Utils.joinPath(outputDirUri, componentName)] });

  const fsService = yield* api.services.FsService;

  const result = yield* api.services.TemplateService.create({
    cwd: yield* fsService.uriToPath(workspaceInfo.uri),
    templateType: api.services.TemplateType.LightningComponent,
    outputdir: outputDirUri,
    options: {
      componentname: componentName,
      template,
      type: 'lwc',
      internal: options?.internal ?? false
    }
  });

  // Custom templates may name their template anything, so the main file extension can't be inferred
  // from the template name (unlike the built-in 'default'/'typeScript' names) - inspect what was created.
  // `created` entries use platform-specific path separators; only the basename is needed.
  const mainFileName = result.created
    .map(created => created.split(/[/\\]/).pop() ?? '')
    .find(name => name === `${componentName}.js` || name === `${componentName}.ts`);
  const ext = mainFileName?.endsWith('.ts') ? '.ts' : '.js';
  const mainFileUri = Utils.joinPath(outputDirUri, componentName, `${componentName}${ext}`);
  yield* fsService.showTextDocument(mainFileUri);
});
