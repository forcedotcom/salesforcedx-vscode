/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../messages';

type XMLExtensionApi = {
  addXMLCatalogs: (catalogs: string[]) => void;
  addXMLFileAssociations: (fileAssociations: { systemId: string; pattern: string }[]) => void;
};

const getLocalFilePath = (extensionUri: URI, targetFileNames: string[]): string[] =>
  targetFileNames.map(name => Utils.joinPath(extensionUri, 'resources', 'static', name).toString());

/**
 * Checks the environment and configures RedHat XML extension
 * with LWC js-meta.xml schema support if a compatible version is installed.
 */
export const activateMetaSupport = Effect.fn('activateMetaSupport')(function* (extensionUri: URI) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;

  // redHatExtension API reference: https://github.com/redhat-developer/vscode-xml/pull/292
  const redHatExtension = vscode.extensions.getExtension<XMLExtensionApi>('redhat.vscode-xml');
  if (redHatExtension === undefined) {
    yield* channelService.appendToChannel(nls.localize('lightning_lwc_no_redhat_extension_found'));
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const pluginVersionNumber = redHatExtension.packageJSON['version'];

  if (typeof pluginVersionNumber !== 'string') {
    yield* channelService.appendToChannel(nls.localize('lightning_lwc_no_redhat_extension_found'));
    return;
  }
  // checks if the installed plugin version is exactly 0.14.0 or 0.16+,
  // 0.15.0 has a regression and 0.13.0 or earlier versions are not supported
  const [major, minor] = pluginVersionNumber.split('.').map(i => parseInt(i, 10));

  if (major >= 1 || minor === 14 || minor >= 16) {
    const catalogs = getLocalFilePath(extensionUri, ['js-meta-home.xml']);
    const fileAssociations = [
      {
        systemId: getLocalFilePath(extensionUri, ['js-meta.xsd'])[0],
        pattern: '**/*js-meta.xml'
      }
    ];
    yield* Effect.tryPromise(async () => {
      if (!redHatExtension.isActive) {
        await redHatExtension.activate();
      }
      redHatExtension.exports.addXMLCatalogs(catalogs);
      redHatExtension.exports.addXMLFileAssociations(fileAssociations);
    }).pipe(Effect.catchAll(() => channelService.appendToChannel(nls.localize('lightning_lwc_fail_redhat_extension'))));
  } else if (minor === 15) {
    yield* channelService.appendToChannel(nls.localize('lightning_lwc_redhat_extension_regression'));
  } else {
    yield* channelService.appendToChannel(nls.localize('lightning_lwc_deprecated_redhat_extension'));
  }
});
