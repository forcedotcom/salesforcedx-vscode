/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Mock as VitestMock } from 'vitest';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { ChannelService, ConnectionService, SettingsService } from '@salesforce/vscode-services/v2';
import * as vscode from 'vscode';
import { executeQueryPlan, formatQueryPlanResults, QueryPlanResponse } from '../../../src/commands/queryPlan';
import { formatErrorMessage } from '../../../src/commands/queryUtils';
import { nls } from '../../../src/messages';
import { prepareQuery } from '../../../src/prepareQuery';

const decode = Schema.decodeUnknownSync(QueryPlanResponse);
const settingsService = {
  getValue: (_section: string, _key: string, defaultValue?: unknown) => Effect.succeed(defaultValue),
  getValueOrElse: (_section: string, _key: string, defaultValue: unknown) => Effect.succeed(defaultValue)
} as unknown as SettingsService['Service'];

const rawNote = {
  description: 'Not considering filter for optimization because unindexed',
  fields: ['IsDeleted'],
  tableEnumOrId: 'Account'
};

const rawPlan = (notes: (typeof rawNote)[]) => ({
  cardinality: 0,
  fields: ['Name'],
  leadingOperationType: 'TableScan',
  notes,
  relativeCost: 0,
  sobjectCardinality: 2,
  sobjectType: 'Account'
});

describe('formatQueryPlanResults', () => {
  it('deduplicates identical notes across plans', () => {
    // Decode through the schema so notes carry Equal/Hash traits (via Schema.Data)
    const response = decode({ plans: [rawPlan([rawNote]), rawPlan([{ ...rawNote }])] });
    const result = formatQueryPlanResults(response);

    const matches = result.match(/Not considering filter/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('keeps distinct notes', () => {
    const response = decode({
      plans: [
        rawPlan([
          { description: 'NoteA', fields: ['Field1'], tableEnumOrId: 'Account' },
          { description: 'NoteB', fields: ['Field2'], tableEnumOrId: 'Contact' }
        ])
      ]
    });
    const result = formatQueryPlanResults(response);

    expect(result).toContain('NoteA');
    expect(result).toContain('NoteB');
  });

  it('returns no-plans message for empty plans', () => {
    const result = formatQueryPlanResults({ plans: [] });
    expect(result).toBe(nls.localize('query_plan_no_plans'));
  });
});

describe('executeQueryPlan', () => {
  const setup = (request: VitestMock) => {
    const show = vi.fn();
    const appendToChannel = vi.fn((_msg: string) => Effect.void);
    const channelService = {
      appendToChannel,
      clearChannel: Effect.void,
      getChannel: Effect.succeed({ show }),
      showChannel: Effect.sync(() => show())
    } as unknown as ChannelService['Service'];
    const connectionService = {
      getConnection: () => Effect.succeed({ request })
    } as unknown as ConnectionService['Service'];
    const servicesApi = {
      v2: {
        services: {
          ConnectionService,
          ChannelService,
          SettingsService
        }
      }
    };
    (vscode.extensions.getExtension as VitestMock).mockReturnValue({ isActive: true, exports: servicesApi });
    return { show, appendToChannel, channelService, connectionService };
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('routes a request rejection through catchAllCause and shows channel once via ensuring', async () => {
    const { show, appendToChannel, channelService, connectionService } = setup(
      vi.fn().mockRejectedValue(new Error('boom'))
    );
    await Effect.runPromise(
      executeQueryPlan('SELECT Id FROM Account').pipe(
        Effect.provideService(ChannelService, channelService),
        Effect.provideService(ConnectionService, connectionService),
        Effect.provideService(SettingsService, settingsService)
      )
    );
    expect(appendToChannel).toHaveBeenCalledWith(formatErrorMessage(new Error('boom')));
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('shows channel exactly once on success (ensuring runs like finally)', async () => {
    const { show, appendToChannel, channelService, connectionService } = setup(
      vi.fn().mockResolvedValue({ plans: [] })
    );
    await Effect.runPromise(
      executeQueryPlan('SELECT Id FROM Account').pipe(
        Effect.provideService(ChannelService, channelService),
        Effect.provideService(ConnectionService, connectionService),
        Effect.provideService(SettingsService, settingsService)
      )
    );
    expect(appendToChannel).toHaveBeenCalledWith(nls.localize('query_plan_complete'));
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('encodes the same prepared SOQL used for Run Query in explain=', async () => {
    const request = vi.fn().mockResolvedValue({ plans: [] });
    const { channelService, connectionService } = setup(request);
    const query = '// header\nSELECT Id FROM Account ALL ROWS;';
    await Effect.runPromise(
      executeQueryPlan(prepareQuery(query).soql).pipe(
        Effect.provideService(ChannelService, channelService),
        Effect.provideService(ConnectionService, connectionService),
        Effect.provideService(SettingsService, settingsService)
      )
    );
    expect(request).toHaveBeenCalledWith(`/query?explain=${encodeURIComponent('SELECT Id FROM Account')}`);
  });
});
