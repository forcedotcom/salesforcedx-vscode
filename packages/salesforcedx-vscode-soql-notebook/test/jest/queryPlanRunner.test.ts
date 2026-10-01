/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

jest.mock('vscode', () => ({
  env: { language: 'en' }
}));

import { runSoqlCellQueryPlan, toQueryPlanEntries } from '../../src/queryPlanRunner';

const rawPlan = {
  cardinality: 1,
  fields: ['Name'],
  leadingOperationType: 'TableScan',
  notes: [{ description: 'unindexed', fields: ['IsDeleted'], tableEnumOrId: 'Account' }],
  relativeCost: 0.5,
  sobjectCardinality: 2,
  sobjectType: 'Account'
};

describe('query plan runner', () => {
  it('maps explain results into a view model', async () => {
    const explain = jest.fn().mockResolvedValue({ plans: [rawPlan] });

    await expect(runSoqlCellQueryPlan('SELECT Name FROM Account', { explain })).resolves.toEqual({
      queryText: 'SELECT Name FROM Account',
      plans: [
        {
          cardinality: 1,
          fields: ['Name'],
          leadingOperationType: 'TableScan',
          notes: [{ description: 'unindexed', fields: ['IsDeleted'], tableEnumOrId: 'Account' }],
          relativeCost: 0.5,
          sobjectCardinality: 2,
          sobjectType: 'Account'
        }
      ]
    });
    expect(explain).toHaveBeenCalledWith('SELECT Name FROM Account');
  });

  it('returns no plans when explain omits them', () => {
    expect(toQueryPlanEntries(undefined)).toEqual([]);
  });
});
