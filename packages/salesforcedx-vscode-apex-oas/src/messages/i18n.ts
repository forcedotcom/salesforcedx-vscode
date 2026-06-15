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
  apex_class_not_valid: 'The Apex Class %s is not valid for OpenAPI document generation.',
  apex_class_not_valid_detail: 'The Apex Class %s is not valid for OpenAPI document generation because %s',
  apex_class_no_eligible_methods:
    'The Apex Class %s has no methods eligible for OpenAPI document generation. Ineligible methods: %s. Ensure the methods are public or global and carry the required annotations.',
  apex_lsp_not_ready: 'The Apex Language Server is still starting up. Wait for indexing to finish, then try again.',
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
  llm_service_unavailable:
    'Could not reach an AI model service, which is required to generate an OpenAPI document for REST (@RestResource) classes. Make sure an extension that provides this service is installed and active, and that you are connected to your org. AuraEnabled classes do not require it.',
  llm_service_gpt_v4_hint:
    'A known regression in version %s of the installed AI model service extension can prevent this; downgrading to a 3.x version is a workaround.',
  llm_connection_failed:
    'Could not connect to the AI model service needed to generate an OpenAPI document for REST (@RestResource) classes. Check your network connection (including any VPN or proxy), confirm you are signed in, and that your org has the required AI access, then try again.',
  llm_monthly_rate_limit:
    'OpenAPI document generation was blocked because the shared AI model hit its monthly rate limit. Try again after the quota resets.',
  merge: 'Manually merge with existing ESR',
  method_not_found_in_doc_symbols: 'Method %s is not found in the document symbols',
  mixed_frameworks_not_allowed:
    'The Apex Class %s mixes Apex Rest and AuraEnabled frameworks, which is not allowed for OpenAPI document generation.',
  no_eligible_method: 'No eligible methods found in the class',
  no_folder_selected: 'Operation canceled: No folder selected.',
  no_oas_doc_in_file: 'No OAS doc detected in the file',
  no_oas_generated: 'LLM did not return any content.',
  no_oas_generated_detail: 'OpenAPI document generation produced no content. Last failure: %s',
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
