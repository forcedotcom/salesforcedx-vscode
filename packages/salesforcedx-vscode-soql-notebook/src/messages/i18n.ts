/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export const messages = {
  channel_name: 'Salesforce SOQL Notebook',
  notebook_intro:
    'Run each SOQL cell against the default org. Use the Tooling and Query Plan checkboxes under a cell to choose extras.',
  empty_query: 'SOQL cell is empty.',
  tooling_api_checked: '$(check) Tooling',
  tooling_api_unchecked: '$(circle-large-outline) Tooling',
  tooling_api_tooltip: 'Run this cell with the Tooling API',
  query_plan_checked: '$(check) Query Plan',
  query_plan_unchecked: '$(circle-large-outline) Query Plan',
  query_plan_tooltip: 'Fetch a query plan on the next run, then turn this off',
  stale_results: 'Results out of date'
} as const;

export type MessageKey = keyof typeof messages;
