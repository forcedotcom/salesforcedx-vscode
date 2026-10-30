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
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { nls } from '../../../src/messages';
import { activateMetaSupport } from '../../../src/metasupport/metaSupport';

describe('LWC XML extension support', () => {
  const appendToChannel = vi.fn(() => Effect.void);
  const run = () =>
    Effect.runPromise(
      activateMetaSupport(URI.file('/extension')).pipe(
        Effect.provide(
          Layer.mergeAll(
            Layer.succeed(ExtensionProviderService, {
              getServicesApi: Effect.succeed({ services: { ChannelService } })
            } as unknown as ExtensionProviderService),
            Layer.succeed(ChannelService, { appendToChannel } as unknown as ChannelService)
          )
        )
      )
    );

  beforeEach(() => {
    appendToChannel.mockImplementation(() => Effect.void);
  });

  it('reports the localized missing extension message', async () => {
    vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);

    await run();

    expect(appendToChannel).toHaveBeenCalledExactlyOnceWith(nls.localize('lightning_lwc_no_redhat_extension_found'));
  });

  it.each(['0.14.0', '0.16.0', '1.0.0'])('activates compatible version %s and registers its exports', async version => {
    const xmlApi = { addXMLCatalogs: vi.fn(), addXMLFileAssociations: vi.fn() };
    const activate = vi.fn().mockResolvedValue(xmlApi);
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      packageJSON: { version },
      isActive: false,
      activate
    } as unknown as vscode.Extension<typeof xmlApi>);

    await run();

    expect(activate).toHaveBeenCalledOnce();
    expect(xmlApi.addXMLCatalogs).toHaveBeenCalledExactlyOnceWith([
      'file:///extension/resources/static/js-meta-home.xml'
    ]);
    expect(xmlApi.addXMLFileAssociations).toHaveBeenCalledExactlyOnceWith([
      { systemId: 'file:///extension/resources/static/js-meta.xsd', pattern: '**/*js-meta.xml' }
    ]);
  });

  it.each([
    ['0.13.0', 'lightning_lwc_deprecated_redhat_extension'],
    ['0.15.0', 'lightning_lwc_redhat_extension_regression'],
    [undefined, 'lightning_lwc_no_redhat_extension_found']
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

  it('reports localized activation failure', async () => {
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      packageJSON: { version: '0.16.0' },
      isActive: false,
      activate: vi.fn().mockRejectedValue(new Error('activation failed'))
    } as unknown as vscode.Extension<unknown>);

    await run();

    expect(appendToChannel).toHaveBeenCalledExactlyOnceWith(nls.localize('lightning_lwc_fail_redhat_extension'));
  });
});
