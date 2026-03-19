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

const APEX_TRIGGER_NAME_MAX_LENGTH = 40;

class UserCancelledOverwriteError extends Data.TaggedError('UserCancelledOverwriteError')<{}> {}

const fromProject = Effect.fn('getApiVersion.fromProject')(function* (project: SfProject) {
  const projectJson = yield* Effect.tryPromise(() => project.retrieveSfProjectJson());
  return String(projectJson.get<string>('sourceApiVersion'));
});

const fromConnection = Effect.fn('getApiVersion.fromConnection')(function* () {
  const connectionService = yield* (yield* (yield* ExtensionProviderService).getServicesApi).services.ConnectionService;
  const connection = yield* connectionService.getConnection();
  return connection.version;
});

const getApiVersion = Effect.fn('getApiVersion')(function* (project: SfProject) {
  return yield* fromProject(project).pipe(
    Effect.orElse(() => fromConnection()),
    Effect.catchAll(() => Effect.succeed('65.0'))
  );
});

const promptForOutputDir = Effect.fn('promptForOutputDir')(function* (project: SfProject) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();

  const items = project.getPackageDirectories().map(pkg => ({
    label: `${pkg.path}/main/default/triggers`,
    description: pkg.default ? '(default)' : undefined,
    uri: Utils.joinPath(workspaceInfo.uri, pkg.path, 'main', 'default', 'triggers')
  }));

  const selected = yield* Effect.promise(() =>
    vscode.window.showQuickPick(items, {
      placeHolder: nls.localize('apex_trigger_output_dir_prompt'),
      matchOnDescription: true
    })
  );

  return selected?.uri;
});

const promptForTriggerName = Effect.fn('promptForTriggerName')(function* () {
  const raw = yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: nls.localize('apex_trigger_name_prompt'),
      placeHolder: nls.localize('apex_trigger_name_placeholder'),
      validateInput: (value: string) => {
        if (!value || value.trim().length === 0) {
          return nls.localize('apex_trigger_name_empty_validation');
        }
        if (value.length > APEX_TRIGGER_NAME_MAX_LENGTH) {
          return nls.localize('apex_trigger_name_max_length_validation', String(APEX_TRIGGER_NAME_MAX_LENGTH));
        }
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) {
          return nls.localize('apex_trigger_name_invalid_validation');
        }
        return undefined;
      }
    })
  );
  return Option.fromNullable(raw?.trim());
});

const checkAndPromptOverwrite = Effect.fn('checkAndPromptOverwrite')(function* (triggerUri: URI, metaUri: URI) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  const [triggerExists, metaExists] = yield* Effect.all(
    [api.services.FsService.fileOrFolderExists(triggerUri), api.services.FsService.fileOrFolderExists(metaUri)],
    { concurrency: 'unbounded' }
  );

  if (!triggerExists && !metaExists) {
    return true;
  }

  const choice = yield* Effect.promise(() =>
    vscode.window.showWarningMessage(
      nls.localize('apex_trigger_already_exists'),
      { modal: true },
      nls.localize('overwrite_button'),
      nls.localize('cancel_button')
    )
  );

  return choice === nls.localize('overwrite_button') ? true : yield* new UserCancelledOverwriteError();
});

/** outputDirParam: explorer context (right-click triggers folder) */
export const createApexTriggerCommand = Effect.fn('createApexTriggerCommand')(function* (outputDirParam?: URI) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
  const project = yield* api.services.ProjectService.getSfProject();

  const nameOpt = yield* promptForTriggerName();
  if (Option.isNone(nameOpt)) {
    return undefined;
  }
  const triggerName = nameOpt.value;

  const outputDirUri = outputDirParam ?? (yield* promptForOutputDir(project));
  if (!outputDirUri) {
    return undefined;
  }

  const apiVersion = yield* getApiVersion(project);

  const triggerUri = Utils.joinPath(outputDirUri, `${triggerName}.trigger`);
  const metaUri = Utils.joinPath(outputDirUri, `${triggerName}.trigger-meta.xml`);

  const overwriteOk = yield* checkAndPromptOverwrite(triggerUri, metaUri).pipe(
    Effect.catchTag('UserCancelledOverwriteError', () => Effect.succeed(false))
  );
  if (!overwriteOk) {
    return undefined;
  }

  const fsService = yield* api.services.FsService;
  const cwd = yield* fsService.uriToPath(workspaceInfo.uri);

  yield* api.services.TemplateService.create({
    cwd,
    templateType: api.services.TemplateType.ApexTrigger,
    outputdir: outputDirUri,
    options: {
      triggername: triggerName,
      triggerevents: ['before insert'],
      sobject: 'SOBJECT',
      template: 'ApexTrigger',
      apiversion: apiVersion
    }
  });

  const channelService = yield* api.services.ChannelService;
  yield* channelService.appendToChannel(nls.localize('apex_generate_trigger_success'));

  yield* fsService.showTextDocument(triggerUri);

  return undefined;
});
