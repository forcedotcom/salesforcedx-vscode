/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { createTable, ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { nls } from '../messages';

export const configListCommand = Effect.fn('configListCommand')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const aggregator = yield* api.services.ConfigService.getConfigAggregator();
  const configInfo = aggregator.getConfigInfo();

  const channelService = yield* api.services.ChannelService;

  const table =
    configInfo.length > 0
      ? createTable(
          configInfo.map(c => ({
            name: c.key,
            value: c.value !== undefined ? String(c.value) : '',
            location: c.location ?? ''
          })),
          [
            { key: 'name', label: nls.localize('config_list_column_name') },
            { key: 'value', label: nls.localize('config_list_column_value') },
            { key: 'location', label: nls.localize('config_list_column_location') }
          ],
          nls.localize('config_list_table_title')
        )
      : nls.localize('config_list_no_results');

  yield* channelService.appendToChannel(table);
  const channel = yield* channelService.getChannel;
  channel.show();
});
