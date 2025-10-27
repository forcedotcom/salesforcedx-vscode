/*
 * Copyright (c) 2025, salesforce.com, inc.
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
  active_text_editor_not_apex: 'The active text editor is not an Apex Class file',
  apex_class_not_valid: 'The Apex Class %s is not valid for OpenAPI document generation.',
  artifact_failed: 'Failed to save the artifact: %s',
  cancel: 'Cancel',
  cannot_gather_context: 'An error occurred while gathering context for the Apex class.',
  cannot_get_apexoaseligibility_response: 'Failed to get response through apexoas/isEligible from Apex Language Server',
  check_openapi_doc_failed: 'Failed to check OpenAPI Document',
  check_openapi_doc_succeeded: 'Validated OpenAPI Document %s successfully',
  class_validation_failed: 'Failed to validate eligibility from %s',
  cleanup_openapi_doc_failed: 'Could not find OpenAPI document in the source:\n',
  create_openapi_doc_failed: 'Failed to create OpenAPI Document',
  eligible_method_not_in_doc: 'Methods %s are eligible for OAS generation, but not present in the document',
  enter_new_nc: 'Enter a custom Named Credential...',
  enter_nc_name: 'Enter the name of the Named Credential',
  error_parsing_nc: 'Error parsing named credentials result',
  error_parsing_yaml: 'Error parsing YAML',
  error_retrieving_org_version: 'Failed to retrieve org version',
  failed_to_combine_oas: 'Failed to combine yaml docs: %s',
  failed_to_parse_yaml: 'Failed to parse the document as YAML: %s',
  file_exists: 'The file already exists. How do you want to proceed?',
  full_path_failed: 'Failed to determine the full path for the OpenAPI document.',
  gathering_context: 'Gathering context data.',
  generate_openapi_document: 'Generating OpenAPI document.',
  generating_oas_doc: 'Generating OpenAPI doc.',
  get_document_path: 'Get OpenAPI document folder name.',
  ineligible_method_in_doc: 'Method %s is not eligible for OAS generation, but present in the document',
  invalid_active_text_editor: 'The active text editor is missing or is an invalid file.',
  invalid_file_for_generating_oas_doc: 'Invalid file for generating OAS doc',
  invalid_file_for_processing_oas_doc: 'Invalid file for processing OAS doc',
  invalid_named_credential: 'The named credential is either not provided or invalid.',
  merge: 'Manually merge with existing ESR',
  method_not_found_in_doc_symbols: 'Method %s is not found in the document symbols',
  mixed_frameworks_not_allowed:
    'The Apex Class %s mixes Apex Rest and AuraEnabled frameworks, which is not allowed for OpenAPI document generation.',
  no_eligible_method: 'No eligible methods found in the class',
  no_folder_selected: 'Operation canceled: No folder selected.',
  no_oas_doc_in_file: 'No OAS doc detected in the file',
  no_oas_generated: 'LLM did not return any content.',
  not_eligible_method:
    'Method %s is not eligible for OpenAPI Document creation. It is not annotated with an http annotator or has wrong access modifiers.',
  openapi_doc_created: 'OpenAPI Document created for %s: %s.',
  openapi_doc_created_merge:
    'A new OpenAPI Document %s %s is created for %s. Manually merge the two files using the diff editor.',
  operation_cancelled: 'Operation canceled',
  operations_element_not_found: 'The <operations> element was not found in the provided XML.',
  overwrite: 'Overwrite',
  processing_generated_oas: 'Verifying generated OpenAPI doc.',
  registry_access_failed: 'Failed to retrieve ESR directory name from the registry.',
  schema_element_not_found: 'The <schema> element was not found in the provided XML.',
  select_folder_for_oas: 'Select folder to store OpenAPI Document',
  select_named_credential: 'Select a Named Credential',
  strategy_not_qualified: 'No generation strategy is qualified for the selected class or method.',
  unknown: 'Unknown',
  unknown_error: 'Unknown error',
  unknown_bid_rule: 'Unknown bid rule "%s"',
  validate_eligibility: 'Validating eligibility.',
  validation_failed: 'Failed to validate eligibility.',
  write_openapi_document: 'Writing OpenAPI Document.',
  yes: 'Yes'
} as const;

export type MessageKey = keyof typeof messages;
