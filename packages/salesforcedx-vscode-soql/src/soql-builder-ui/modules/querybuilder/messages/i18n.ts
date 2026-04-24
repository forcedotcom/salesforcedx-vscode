/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Conventions:
 * label_*   : text displayed as-is (section labels, notification messages, column headers)
 * action_*  : text on interactive elements (buttons, links)
 * placeholder_* : input/select placeholder text
 */
export const messages = {
  // app – no-default-org notification
  label_no_default_org:
    'SOQL Builder requires a default org. Use the "Set a Default Org" button or run "SFDX: Set a Default Org" from the command palette to set one.',
  action_set_default_org: 'Set a Default Org',

  // app – unsupported-query notification
  label_unsupported_query_title:
    "Your query contains statements that SOQL Builder doesn't currently support.",
  label_unsupported_query_run_info:
    "You can use the 'Run Query' button to run your query as is.",
  label_unsupported_query_edit_info:
    'Consider using a text editor to edit the query. If you click Edit Query Anyway, SOQL Builder removes the unsupported syntax.',

  // app – syntax-error notification
  label_syntax_error_title: "Your query contains syntax errors that SOQL Builder can't parse.",
  label_syntax_error_edit_info:
    'Consider using a text editor to edit the query. If you click Edit Query Anyway, SOQL Builder will rewrite your query.',

  // app – shared action
  action_edit_query_anyway: 'Edit Query Anyway',

  // header
  action_run_query: 'Run Query',
  label_running: 'Running...',
  action_get_query_plan: 'Get Query Plan',
  label_getting_plan: 'Getting Plan...',

  // where
  label_filter: 'Filter',
  label_field: 'Field',
  label_operator: 'Operator',
  label_value: 'Value',

  // shared action
  action_add: 'Add',

  // fields
  label_fields: 'Fields',

  // from
  label_from: 'From',

  // order by
  label_order_by: 'Order By',
  placeholder_direction: 'Direction...',
  label_ascending: 'Ascending',
  label_descending: 'Descending',
  placeholder_nulls: 'Nulls...',
  label_nulls_first: 'Nulls First',
  label_nulls_last: 'Nulls Last',

  // limit
  label_limit: 'Limit',
  placeholder_limit: 'Limit...',

  // customSelect / shared
  label_no_results_found: 'No results found.',
  label_loading: 'Loading...',

  // query preview
  label_soql_query: 'SOQL Query',

  // placeholders
  placeholder_search_object: 'Search object...',
  placeholder_search_fields: 'Search fields...',
  placeholder_select_field: 'Select Field...',

  // fields – relationship navigation
  action_back_to_fields: 'Back to fields'
} as const;

export type MessageKey = keyof typeof messages;
