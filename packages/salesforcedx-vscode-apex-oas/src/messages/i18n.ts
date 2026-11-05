/*
 * Copyright (c) 2026, salesforce.com, inc.
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
  channel_name: 'Apex OpenAPI Specification',
  apex_class_not_valid_detail: 'The Apex Class %s is not valid for OpenAPI document generation because %s.',
  cannot_gather_context: 'An error occurred while gathering context for the Apex class.',
  check_openapi_doc_succeeded: 'Validated OpenAPI Document %s successfully',
  create_openapi_doc_class: 'SFDX: Create OpenAPI Document from This Class',
  eligible_method_not_in_doc: 'Methods %s are eligible for OAS generation, but not present in the document',
  file_exists: 'The file already exists. How do you want to proceed?',
  generating_oas_progress_title: 'Generating OpenAPI Document for %s',
  generating_oas_progress_generating: 'Generating specification…',
  generating_oas_progress_processing: 'Processing document…',
  generating_oas_progress_writing: 'Writing OpenAPI Document…',
  ineligible_method_in_doc: 'Method %s is not eligible for OAS generation, but present in the document',
  invalid_file_for_generating_oas_doc: 'Invalid file for generating OAS doc',
  merge: 'Manually merge with existing ESR',
  no_eligible_method: 'No eligible methods found in the class',
  no_folder_selected: 'Operation canceled: No folder selected.',
  no_oas_doc_in_file: 'No OAS doc detected in the file',
  openapi_doc_created: 'OpenAPI Document created for %s: %s.',
  openapi_doc_created_merge:
    'A new OpenAPI Document %s %s is created for %s. Manually merge the two files using the diff editor.',
  operation_cancelled: 'Operation canceled',
  overwrite: 'Overwrite',
  registry_access_failed: 'Failed to retrieve ESR directory name from the registry.',
  rest_oas_gen_retired: 'OpenAPI document generation for Apex REST (@RestResource) classes is no longer supported.',
  select_folder_for_oas: 'Select folder to store OpenAPI Document',
  validate_oas_document: 'SFDX: Validate OpenAPI Document'
} as const;
