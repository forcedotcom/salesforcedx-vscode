/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { formatQueryPlanResults, QueryPlanResponse } from '../../../src/commands/queryPlan';
import { nls } from '../../../src/messages';

const decode = Schema.decodeUnknownSync(QueryPlanResponse);

const rawNote = {
  description: 'Not considering filter for optimization because unindexed',
  fields: ['IsDeleted'],
  tableEnumOrId: 'Account'
};

const rawPlan = (notes: typeof rawNote[]) => ({
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
    expect(matches.length).toBe(1);
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
