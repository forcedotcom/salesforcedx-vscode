/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { ChannelService } from 'salesforcedx-vscode-services/src/vscode/channelService';
import { ExtensionContextService } from 'salesforcedx-vscode-services/src/vscode/extensionContextService';
import { SettingsService } from 'salesforcedx-vscode-services/src/vscode/settingsService';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { nls } from '../../../src/messages';
import { initializeMetadataSupport } from '../../../src/metadataSupport/metadataXmlSupport';

describe('metadata XML extension activation', () => {
  const appendToChannel = vi.fn(() => Effect.void);
  const run = () =>
    Effect.runPromise(
      initializeMetadataSupport().pipe(
        Effect.provide(
          Layer.mergeAll(
            Layer.succeed(ExtensionProviderService, {
              getServicesApi: Effect.succeed({ services: { ChannelService, ExtensionContextService, SettingsService } })
            } as unknown as ExtensionProviderService),
            Layer.succeed(ChannelService, { appendToChannel } as unknown as ChannelService),
            Layer.succeed(ExtensionContextService, {
              getContext: Effect.succeed({ extensionUri: URI.file('/extension') })
            } as unknown as ExtensionContextService),
            Layer.succeed(SettingsService, {
              getValueOrElse: () => Effect.succeed(true)
            } as unknown as SettingsService)
          )
        )
      )
    );

  beforeEach(() => {
    appendToChannel.mockImplementation(() => Effect.void);
    vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      inspect: () => ({ globalValue: '-Xmx1024M' })
    } as unknown as vscode.WorkspaceConfiguration);
  });

  it('reports the localized missing extension message', async () => {
    vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);

    await run();

    expect(appendToChannel).toHaveBeenCalledExactlyOnceWith(nls.localize('metadata_xml_no_redhat_extension_found'));
  });

  it.each(['0.14.0', '0.16.0', '1.0.0'])('activates compatible version %s and registers exports', async version => {
    const xmlApi = { addXMLCatalogs: vi.fn(), addXMLFileAssociations: vi.fn() };
    const activate = vi.fn().mockResolvedValue(xmlApi);
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      packageJSON: { version },
      isActive: false,
      activate
    } as unknown as vscode.Extension<typeof xmlApi>);

    await run();

    expect(activate).toHaveBeenCalledOnce();
    expect(xmlApi.addXMLCatalogs).toHaveBeenCalledExactlyOnceWith(['/extension/resources/metadata-catalog.xml']);
    expect(xmlApi.addXMLFileAssociations).toHaveBeenCalledExactlyOnceWith([
      { systemId: '/extension/resources/salesforce_metadata_api_namespace1.xsd', pattern: '**/*-meta.xml' }
    ]);
    expect(appendToChannel).toHaveBeenCalledWith(nls.localize('metadata_xml_redhat_extension_setup_success'));
  });

  it.each([
    ['0.13.0', 'metadata_xml_deprecated_redhat_extension'],
    ['0.15.0', 'metadata_xml_redhat_extension_regression'],
    ['', 'metadata_xml_no_redhat_extension_found']
  ] as const)('does not activate incompatible version %s', async (version, message) => {
    const activate = vi.fn();
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      packageJSON: { version },
      isActive: false,
      activate
    } as unknown as vscode.Extension<unknown>);

    await run();

    expect(activate).not.toHaveBeenCalled();
    expect(appendToChannel).toHaveBeenCalledExactlyOnceWith(nls.localize(message));
  });

  it('reports localized activation failure and the original cause', async () => {
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      packageJSON: { version: '0.16.0' },
      isActive: false,
      activate: vi.fn().mockRejectedValue(new Error('activation failed'))
    } as unknown as vscode.Extension<unknown>);

    await run();

    expect(appendToChannel).toHaveBeenNthCalledWith(1, nls.localize('metadata_xml_fail_redhat_extension'));
    expect(appendToChannel).toHaveBeenNthCalledWith(2, 'activation failed');
  });
});
