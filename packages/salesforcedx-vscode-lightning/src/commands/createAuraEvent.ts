/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../messages';
import { promptForAuraName } from './promptForAuraName';

export const createAuraEventCommand = Effect.fn('createAuraEventCommand')(function* (
  outputDirParam?: URI,
  options?: { internal?: boolean }
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const project = yield* api.services.ProjectService.getSfProject();
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
  const fsService = yield* api.services.FsService;

  const eventName = yield* promptForAuraName();

  const defaultUri = Utils.joinPath(workspaceInfo.uri, project.getDefaultPackage().path, 'main', 'default', 'aura');

  const outputDirUri =
    outputDirParam ??
    (yield* promptService.promptForOutputDir({
      defaultUri,
      folderName: 'aura',
      pickerPlaceHolder: nls.localize('aura_output_dir_prompt')
    }));

  const componentDirUri = Utils.joinPath(outputDirUri, eventName);
  yield* promptService.ensureMetadataOverwriteOrThrow({ uris: [componentDirUri] });

  yield* api.services.TemplateService.create({
    cwd: yield* fsService.uriToPath(workspaceInfo.uri),
    templateType: api.services.TemplateType.LightningEvent,
    outputdir: outputDirUri,
    options: {
      eventname: eventName,
      template: 'DefaultLightningEvt',
      internal: options?.internal ?? false
    }
  });

  const channelService = yield* api.services.ChannelService;
  yield* channelService.appendToChannel(nls.localize('aura_generate_event_success'));
  yield* fsService.showTextDocument(Utils.joinPath(componentDirUri, `${eventName}.evt`));
});
