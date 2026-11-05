/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { AliasService, ChannelService } from '@salesforce/vscode-services/v2';
import { aliasListCommand } from '../../../src/commands/aliasList';

describe('aliasListCommand', () => {
  it('writes the Alias/Username table to the channel and shows it', async () => {
    const getAllAliases = vi.fn(() =>
      Effect.succeed({
        minimalTestOrg: 'test@example.com',
        devHub: 'hub@example.com'
      })
    );
    const appendToChannel = vi.fn<(_alias: string) => Effect.Effect<void>>(() => Effect.void);
    const show = vi.fn();

    const aliasService = { getAllAliases } as unknown as AliasService['Service'];
    const channelService = {
      appendToChannel,
      showChannel: Effect.sync(() => show())
    } as unknown as ChannelService['Service'];
    await Effect.runPromise(
      aliasListCommand().pipe(
        Effect.provideService(ExtensionProviderService, {
          getServicesApi: Effect.succeed({
            v2: { services: { AliasService, ChannelService } }
          })
        } as unknown as ExtensionProviderService['Service']),
        Effect.provideService(AliasService, aliasService),
        Effect.provideService(ChannelService, channelService)
      ) as Effect.Effect<void, unknown, never>
    );

    expect(getAllAliases).toHaveBeenCalledTimes(1);
    expect(appendToChannel).toHaveBeenCalledTimes(1);
    expect(appendToChannel.mock.calls[0][0]).toContain('Alias');
    expect(appendToChannel.mock.calls[0][0]).toContain('Username');
    expect(appendToChannel.mock.calls[0][0]).toContain('minimalTestOrg  test@example.com');
    expect(appendToChannel.mock.calls[0][0]).toContain('devHub          hub@example.com');
    expect(show).toHaveBeenCalledTimes(1);
  });
});
