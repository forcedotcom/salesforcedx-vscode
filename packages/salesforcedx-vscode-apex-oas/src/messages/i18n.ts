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
  channel_name: 'Apex OpenAPI Specification',
  apex_class_not_valid: 'The Apex Class %s is not valid for OpenAPI document generation.',
  artifact_failed: 'Failed to save the artifact: %s',
  cannot_gather_context: 'An error occurred while gathering context for the Apex class.',
  cannot_get_apexoaseligibility_response: 'Failed to get response through apexoas/isEligible from Apex Language Server',
  check_openapi_doc_succeeded: 'Validated OpenAPI Document %s successfully',
  eligible_method_not_in_doc: 'Methods %s are eligible for OAS generation, but not present in the document',
  failed_to_combine_oas: 'Failed to combine yaml docs: %s',
  file_exists: 'The file already exists. How do you want to proceed?',
  http_verb_prompt_get: 'For the given method only produce the GET verb.',
  http_verb_prompt_patch: 'For the given method only produce the PATCH verb.',
  http_verb_prompt_post: 'For the given method only produce the POST verb.',
  http_verb_prompt_put: 'For the given method only produce the PUT verb.',
  http_verb_prompt_delete: 'For the given method only produce the DELETE verb.',
  ineligible_method_in_doc: 'Method %s is not eligible for OAS generation, but present in the document',
  invalid_file_for_generating_oas_doc: 'Invalid file for generating OAS doc',
  merge: 'Manually merge with existing ESR',
  method_not_found_in_doc_symbols: 'Method %s is not found in the document symbols',
  mixed_frameworks_not_allowed:
    'The Apex Class %s mixes Apex Rest and AuraEnabled frameworks, which is not allowed for OpenAPI document generation.',
  no_eligible_method: 'No eligible methods found in the class',
  no_folder_selected: 'Operation canceled: No folder selected.',
  no_oas_doc_in_file: 'No OAS doc detected in the file',
  no_oas_generated: 'LLM did not return any content.',
  openapi_doc_created: 'OpenAPI Document created for %s: %s.',
  openapi_doc_created_merge:
    'A new OpenAPI Document %s %s is created for %s. Manually merge the two files using the diff editor.',
  operation_cancelled: 'Operation canceled',
  overwrite: 'Overwrite',
  registry_access_failed: 'Failed to retrieve ESR directory name from the registry.',
  select_folder_for_oas: 'Select folder to store OpenAPI Document',
  strategy_not_qualified: 'No generation strategy is qualified for the selected class or method.',
  validation_failed: 'Failed to validate eligibility.'
} as const;
