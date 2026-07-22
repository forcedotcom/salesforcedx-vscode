/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { ChannelService } from 'salesforcedx-vscode-services/out/src/vscode/channelService';
import { ConnectionService } from 'salesforcedx-vscode-services/out/src/core/connectionService';
import * as vscode from 'vscode';
import { executeQueryPlan, formatQueryPlanResults, QueryPlanResponse } from '../../../src/commands/queryPlan';
import { formatErrorMessage } from '../../../src/commands/queryUtils';
import { nls } from '../../../src/messages';

const decode = Schema.decodeUnknownSync(QueryPlanResponse);

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
  const setup = (request: jest.Mock) => {
    const show = jest.fn();
    const appendToChannel = jest.fn((_msg: string) => Effect.void);
    const servicesApi = {
      services: {
        ConnectionService: { getConnection: () => Effect.succeed({ request }) },
        ChannelService: Effect.succeed({
          appendToChannel,
          clearChannel: Effect.void,
          getChannel: Effect.succeed({ show }),
          showChannel: Effect.sync(() => show())
        })
      }
    };
    (vscode.extensions.getExtension as jest.Mock).mockReturnValue({ isActive: true, exports: servicesApi });
    return { show, appendToChannel };
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('routes a request rejection through catchAllCause and shows channel once via ensuring', async () => {
    const { show, appendToChannel } = setup(jest.fn().mockRejectedValue(new Error('boom')));
    await Effect.runPromise(
      executeQueryPlan('SELECT Id FROM Account').pipe(
        Effect.provideService(ChannelService, {} as unknown as ChannelService),
        Effect.provideService(ConnectionService, {} as unknown as ConnectionService)
      )
    );
    expect(appendToChannel).toHaveBeenCalledWith(formatErrorMessage(new Error('boom')));
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('shows channel exactly once on success (ensuring runs like finally)', async () => {
    const { show, appendToChannel } = setup(jest.fn().mockResolvedValue({ plans: [] }));
    await Effect.runPromise(
      executeQueryPlan('SELECT Id FROM Account').pipe(
        Effect.provideService(ChannelService, {} as unknown as ChannelService),
        Effect.provideService(ConnectionService, {} as unknown as ConnectionService)
      )
    );
    expect(appendToChannel).toHaveBeenCalledWith(nls.localize('query_plan_complete'));
    expect(show).toHaveBeenCalledTimes(1);
  });
});
