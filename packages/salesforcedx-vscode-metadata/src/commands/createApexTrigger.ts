/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { Utils, URI } from 'vscode-uri';
import { nls } from '../messages';
import { promptForApexTypeName } from '../templates-shared/sfTemplateProjectHelpers';

/** outputDirParam: explorer context (right-click triggers folder) */
export const createApexTriggerCommand = Effect.fn('createApexTriggerCommand')(function* (outputDirParam?: URI) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
  const project = yield* api.services.ProjectService.getSfProject();

  const triggerName = yield* promptForApexTypeName({
    prompt: nls.localize('apex_trigger_name_prompt')
  });

  const defaultPkg = project.getPackageDirectories().find(p => p.default) ?? project.getPackageDirectories()[0];
  const defaultUri = Utils.joinPath(workspaceInfo.uri, defaultPkg.path, 'main', 'default', 'triggers');

  const outputDirUri =
    outputDirParam ??
    (yield* promptService.promptForOutputDir({
      defaultUri,
      pickerPlaceHolder: nls.localize('apex_trigger_output_dir_prompt')
    }));

  const triggerUri = Utils.joinPath(outputDirUri, `${triggerName}.trigger`);
  const metaUri = Utils.joinPath(outputDirUri, `${triggerName}.trigger-meta.xml`);

  yield* promptService.ensureMetadataOverwriteOrThrow({ uris: [triggerUri, metaUri] });

  const fsService = yield* api.services.FsService;

  yield* api.services.TemplateService.create({
    cwd: yield* fsService.uriToPath(workspaceInfo.uri),
    templateType: api.services.TemplateType.ApexTrigger,
    outputdir: outputDirUri,
    options: {
      triggername: triggerName,
      triggerevents: ['before insert'],
      sobject: 'SOBJECT',
      template: 'ApexTrigger'
    }
  });

  const channelService = yield* api.services.ChannelService;
  yield* channelService.appendToChannel(nls.localize('apex_generate_trigger_success'));

  yield* fsService.showTextDocument(triggerUri);

  return undefined;
});
