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
import { promptForVfTypeName } from './vfTemplateProjectHelpers';

export const createVisualforcePageCommand = Effect.fn('createVisualforcePageCommand')(function* (arg?: URI) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const project = yield* api.services.ProjectService.getSfProject();
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();

  const pageName = yield* promptForVfTypeName(nls.localize('vf_page_name_prompt'));

  const defaultUri = Utils.joinPath(
    workspaceInfo.uri,
    project.getDefaultPackage().path,
    'main',
    'default',
    'pages'
  );

  const outputDirUri =
    arg ??
    (yield* promptService.promptForOutputDir({
      defaultUri,
      pickerPlaceHolder: nls.localize('output_dir_prompt')
    }));

  const uris = [`${pageName}.page`, `${pageName}.page-meta.xml`].map(f => Utils.joinPath(outputDirUri, f));
  const fsService = yield* api.services.FsService;
  yield* promptService.ensureMetadataOverwriteOrThrow({ uris });

  yield* api.services.TemplateService.create({
    cwd: yield* api.services.FsService.uriToPath(workspaceInfo.uri),
    templateType: api.services.TemplateType.VisualforcePage,
    outputdir: outputDirUri,
    options: { pagename: pageName, label: pageName, template: 'DefaultVFPage' }
  });

  const channelService = yield* api.services.ChannelService;
  yield* channelService.appendToChannel(nls.localize('vf_generate_page_success'));
  yield* fsService.showTextDocument(uris[0]);

  return undefined;
});
