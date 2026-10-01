/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { aliasListCommand } from '../../../src/commands/aliasList';

describe('aliasListCommand', () => {
  it('writes the Alias/Username table to the channel and shows it', async () => {
    const getAllAliases = jest.fn(() =>
      Effect.succeed({
        minimalTestOrg: 'test@example.com',
        devHub: 'hub@example.com'
      })
    );
    const appendToChannel = jest.fn<Effect.Effect<void>, [string]>(() => Effect.void);
    const show = jest.fn();

    await Effect.runPromise(
      aliasListCommand().pipe(
        Effect.provideService(ExtensionProviderService, {
          getServicesApi: Effect.succeed({
            services: {
              AliasService: { getAllAliases },
              ChannelService: Effect.succeed({
                appendToChannel,
                showChannel: Effect.sync(() => show())
              })
            }
          })
        } as unknown as ExtensionProviderService)
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
