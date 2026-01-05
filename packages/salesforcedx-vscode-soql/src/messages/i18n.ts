/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Conventions:
 * _message: is for unformatted text that will be shown as-is to
 * the user.
 * _text: is for text that will appear in the UI, possibly with
 * decorations, e.g., $(x) uses the https://octicons.github.com/ and should not
 * be localized
 *
 * If omitted, we will assume _message.
 */
export const messages = {
  soql_channel_name: 'SOQL Extension',
  progress_running_query: 'Running query',
  soql_query_results: 'SOQL Query Results',
  info_no_default_org:
    'INFO: No default org found. Set a default org to use SOQL Builder. Run "SFDX: Create a Default Scratch Org" or "SFDX: Authorize an Org" to set one.',
  info_syntax_unsupported: 'INFO: This syntax is not yet supported in SOQL Builder. Instead, use a text editor.',
  info_file_save_success: 'We saved the results as: %s',
  error_sobject_metadata_request:
    "ERROR: We can't retrieve the fields for %s. Make sure that you're connected to an authorized org and have permissions to view the object and fields.",
  error_sobjects_request:
    "ERROR: We can't retrieve the objects in the org. Make sure that you're connected to an authorized org and have permissions to view the objects in the org.",
  error_run_soql_query: "ERROR: We can't run the SOQL query. %s",
  error_unknown_error:
    'ERROR: %s. Unknown error. Open an issue and provide the error message details: https://github.com/forcedotcom/soql-tooling/issues/new/choose.',
  error_data_view_save:
    "ERROR: We can't save the file to the specified directory. Make sure you have write permissions for the directory.",
  error_connection:
    "ERROR: We can't query your org. Make sure that you're connected to this org and have permissions to view the object and fields.",
  error_sobject_metadata_fs_request: "ERROR: We can't retrieve the fields for %s. Expected metadata file at: %s.",
  error_sobjects_fs_request: "ERROR: We can't retrieve list of objects. Expected JSON files in directory: %s.",
  error_no_workspace_folder: 'ERROR: Unable to find workspace SFDX folder',
  data_query_input_text: 'SFDX: Execute SOQL Query...',
  data_query_selection_text: 'SFDX: Execute SOQL Query with Currently Selected Text',
  data_query_success_message: 'Query executed successfully. Found %d records. Results saved to: %s',
  data_query_error_message: 'Error executing query: %s',
  data_query_error_org_expired:
    'Your org appears to have expired or is no longer accessible. Please refresh your org connection or authorize a new org.',
  data_query_error_session_expired: 'Your session has expired. Please refresh your org connection.',
  data_query_error_invalid_login: 'Invalid login credentials. Please re-authorize your org.',
  data_query_error_insufficient_access:
    'Insufficient access rights. You may not have permission to execute this query.',
  data_query_error_malformed_query: 'The SOQL query is malformed. Please check your query syntax.',
  data_query_error_invalid_field: 'One or more fields in your query are invalid. Please check the field names.',
  data_query_error_invalid_type: 'One or more object types in your query are invalid. Please check the object names.',
  data_query_error_connection: 'Unable to connect to your org. Please check your internet connection and org status.',
  data_query_error_tooling_not_found:
    "The requested metadata was not found. This may be because it doesn't exist or you don't have access to it.",
  data_query_open_file: 'Open File',
  data_query_running_query: 'Running query...',
  data_query_warning_limit:
    'Warning: The query result is missing %d records due to a %d record limit. Increase the number of records returned by setting the config value "org-max-query-limit" or the environment variable "SF_ORG_MAX_QUERY_LIMIT" to %d or greater than %d.',
  data_query_complete: 'Query complete with %d records returned',
  data_query_no_records: 'No records found',
  data_query_table_title: 'Query Results',
  parameter_gatherer_enter_soql_query: 'Enter the SOQL query',
  REST_API: 'REST API',
  REST_API_description: 'Use REST API to execute the query',
  tooling_API: 'Tooling API',
  tooling_API_description: 'Use Tooling API to execute the query'
} as const;

export type MessageKey = keyof typeof messages;
