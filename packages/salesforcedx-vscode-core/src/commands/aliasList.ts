/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { createTable, ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';

export const aliasListCommand = Effect.fn('aliasListCommand')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const aliases = yield* api.services.AliasService.getAllAliases();
  const channelService = yield* api.services.ChannelService;

  const table = createTable(
    Object.entries(aliases).map(([alias, username]) => ({ alias, username })),
    [
      { key: 'alias', label: 'Alias' },
      { key: 'username', label: 'Username' }
    ]
  );

  yield* channelService.appendToChannel(table);
  const channel = yield* channelService.getChannel;
  channel.show();
});
