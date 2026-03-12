/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SfProject } from '@salesforce/core/project';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as vscode from 'vscode';
import { Utils, URI } from 'vscode-uri';
import { nls } from '../messages';

const LWC_EXTENSION_NAME = 'salesforcedx-vscode-lwc';
const LWC_PREVIEW_TYPESCRIPT_SUPPORT = 'preview.typeScriptSupport';

class UserCancelledOverwriteError extends Data.TaggedError('UserCancelledOverwriteError')<{}> {}

const getHasTypeScriptSupport = (): boolean =>
  vscode.workspace.getConfiguration(LWC_EXTENSION_NAME).get(LWC_PREVIEW_TYPESCRIPT_SUPPORT, false);

/** Prompt user to select output directory from available package directories (lwc subdir) */
const promptForOutputDir = Effect.fn('promptForOutputDir')(function* (project: SfProject) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();

  const items = project.getPackageDirectories().map(pkg => ({
    label: `${pkg.path}/main/default/lwc`,
    description: pkg.default ? '(default)' : undefined,
    uri: Utils.joinPath(workspaceInfo.uri, pkg.path, 'main', 'default', 'lwc')
  }));

  const selected = yield* Effect.promise(() =>
    vscode.window.showQuickPick(items, {
      placeHolder: nls.localize('lwc_output_dir_prompt') ?? 'Select output directory',
      matchOnDescription: true
    })
  );

  return selected?.uri;
});

const promptForComponentName = Effect.fn('promptForComponentName')(function* () {
  const raw = yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: nls.localize('lwc_component_name_prompt'),
      placeHolder: nls.localize('lwc_component_name_placeholder'),
      validateInput: (value: string) => {
        if (!value || value.trim().length === 0) return 'Component name cannot be empty';
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value))
          return 'Component name must start with a letter and contain only alphanumeric characters and underscores';
        return undefined;
      }
    })
  );
  return Option.fromNullable(raw?.trim());
});

const promptForComponentType = Effect.fn('promptForComponentType')(function* () {
  const selected = yield* Effect.promise(() =>
    vscode.window.showQuickPick(
      [
        { label: 'JavaScript', value: 'default' as const },
        { label: 'TypeScript', value: 'typeScript' as const }
      ],
      { placeHolder: nls.localize('lwc_select_component_type') ?? 'Select component type' }
    )
  );
  return Option.fromNullable(selected?.value);
});

/** Check if component directory exists and prompt for overwrite */
const checkAndPromptOverwrite = Effect.fn('checkAndPromptOverwrite')(function* (componentDirUri: URI) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const exists = yield* api.services.FsService.fileOrFolderExists(componentDirUri);
  if (!exists) return true;

  const choice = yield* Effect.promise(() =>
    vscode.window.showWarningMessage(
      nls.localize('lwc_already_exists') ?? 'Component already exists. Do you want to overwrite it?',
      { modal: true },
      nls.localize('overwrite_button'),
      nls.localize('cancel_button')
    )
  );

  return choice === nls.localize('overwrite_button') ? true : yield* new UserCancelledOverwriteError();
});

/** Create LWC via TemplateService from services extension.
 * outputDir: when invoked from explorer context (right-click lwc folder), VS Code passes the folder URI */
export const createLwcCommand = Effect.fn('createLwcCommand')(function* (outputDirParam?: URI) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const project = yield* api.services.ProjectService.getSfProject();
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();

  const componentNameOpt = yield* promptForComponentName();
  if (Option.isNone(componentNameOpt)) return undefined;

  const outputDirUri = outputDirParam ?? (yield* promptForOutputDir(project));
  if (!outputDirUri) return undefined;

  const hasTsSupport = getHasTypeScriptSupport();
  const templateOpt = hasTsSupport ? yield* promptForComponentType() : Option.some('default' as const);
  if (Option.isNone(templateOpt)) return undefined;
  const template = templateOpt.value;

  yield* Effect.annotateCurrentSpan({
    componentName: componentNameOpt.value,
    outputDir: outputDirUri.toString(),
    template
  });

  const componentDirUri = Utils.joinPath(outputDirUri, componentNameOpt.value);
  const overwriteOk = yield* checkAndPromptOverwrite(componentDirUri).pipe(
    Effect.catchTag('UserCancelledOverwriteError', () => Effect.succeed(false))
  );
  if (!overwriteOk) return undefined;
  const fsService = yield* api.services.FsService;

  yield* api.services.TemplateService.create({
    cwd: yield* fsService.uriToPath(workspaceInfo.uri),
    templateType: api.services.TemplateType.LightningComponent,
    outputdir: outputDirUri,
    options: {
      componentname: componentNameOpt.value,
      template,
      type: 'lwc',
      internal: false
    }
  });

  const channelService = yield* api.services.ChannelService;
  yield* channelService.appendToChannel(nls.localize('lwc_generate_success'));

  const ext = template === 'typeScript' ? '.ts' : '.js';
  // @salesforce/templates uses camelCase for LWC dir and filename (lightningComponentGenerator.js:69)
  const camelCaseName = `${componentNameOpt.value.substring(0, 1).toLowerCase()}${componentNameOpt.value.substring(1)}`;
  const actualDirUri = Utils.joinPath(outputDirUri, camelCaseName);
  const mainFileUri = Utils.joinPath(actualDirUri, `${camelCaseName}${ext}`);
  yield* fsService.showTextDocument(mainFileUri);

  return undefined;
});
