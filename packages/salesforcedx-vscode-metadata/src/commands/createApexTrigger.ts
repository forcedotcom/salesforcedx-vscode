/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { Utils, URI } from 'vscode-uri';
import { APEX_CLASS_NAME_MAX_LENGTH } from '../constants';
import { nls } from '../messages';
import {
  getApiVersion,
  promptForApexTypeName,
  promptForPackageMetadataSubdir
} from '../templates-shared/sfTemplateProjectHelpers';
import { checkAndPromptOverwriteUris } from '../templates-shared/templateOverwrite';

/** outputDirParam: explorer context (right-click triggers folder) */
export const createApexTriggerCommand = Effect.fn('createApexTriggerCommand')(function* (outputDirParam?: URI) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
  const project = yield* api.services.ProjectService.getSfProject();

  const nameOpt = yield* promptForApexTypeName({
    prompt: nls.localize('apex_trigger_name_prompt'),
    placeHolder: nls.localize('apex_trigger_name_placeholder'),
    messages: {
      empty: nls.localize('apex_trigger_name_empty_validation'),
      invalidFormat: nls.localize('apex_trigger_name_invalid_validation'),
      maxLength: nls.localize('apex_trigger_name_max_length_validation', String(APEX_CLASS_NAME_MAX_LENGTH))
    }
  });
  if (Option.isNone(nameOpt)) return undefined;
  const triggerName = nameOpt.value;

  const outputDirUri =
    outputDirParam ?? (yield* promptForPackageMetadataSubdir(project, 'triggers', nls.localize('apex_trigger_output_dir_prompt')));
  if (!outputDirUri) return undefined;

  const apiVersion = yield* getApiVersion(project);

  const triggerUri = Utils.joinPath(outputDirUri, `${triggerName}.trigger`);
  const metaUri = Utils.joinPath(outputDirUri, `${triggerName}.trigger-meta.xml`);

  const overwriteOk = yield* checkAndPromptOverwriteUris(
    [triggerUri, metaUri],
    nls.localize('apex_trigger_already_exists')
  ).pipe(Effect.catchTag('UserCancelledOverwriteError', () => Effect.succeed(false)));
  if (!overwriteOk) return undefined;

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
