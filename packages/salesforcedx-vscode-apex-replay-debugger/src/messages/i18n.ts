/*
 * Copyright (c) 2018, salesforce.com, inc.
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
 * If ommitted, we will assume _message.
 */
export const messages = {
  config_name_text: 'Launch Apex Replay Debugger',
  session_language_server_error_text:
    'Apex language server could not provide information about valid breakpoints.',
  up_to_five_checkpoints:
    'You have %s of the maximum 5 enabled checkpoints. Remove or disable checkpoints until 5 or fewer are active.',
  checkpoints_can_only_be_on_valid_apex_source:
    'Checkpoints can be set on a valid line of Apex source. Invalid checkpoint location: URI=%s, Line=%s',
  local_source_is_out_of_sync_with_the_server:
    "The local source is out of sync with the server. Push any changes you've made locally to your org, and pull any changes you've made in the org into your local project.",
  long_command_start: 'Starting',
  long_command_end: 'Ending',
  sfdx_update_checkpoints_in_org: 'SFDX: Update Checkpoints in Org',
  checkpoint_creation_status_org_info:
    'Step 1 of 6: Retrieving org information',
  checkpoint_creation_status_source_line_info:
    'Step 2 of 6: Retrieving source and line information',
  checkpoint_creation_status_setting_typeref:
    'Step 3 of 6: Setting typeRefs for checkpoints',
  checkpoint_creation_status_clearing_existing_checkpoints:
    'Step 4 of 6: Clearing existing checkpoints',
  checkpoint_creation_status_uploading_checkpoints:
    'Step 5 of 6: Uploading checkpoints',
  checkpoint_creation_status_processing_complete_success:
    'Step 6 of 6: Confirming successful checkpoint creation',
  checkpoint_upload_in_progress:
    'A checkpoint update is currently in progress for your org. Wait for the update to complete before you add or remove checkpoints.',
  checkpoint_upload_error_wrap_up_message:
    'Your checkpoints have errors. Fix the errors listed in the output, then run %s again.',
  // These strings are going to be re-worked to become better, Salesforce appropriate, error messages.
  cannot_determine_workspace:
    'Unable to determine workspace folders for workspace',
  cannot_delete_existing_checkpoint: 'Cannot delete existing checkpoint',
  unable_to_parse_checkpoint_query_result:
    'Unable to parse checkpoint query result',
  unable_to_retrieve_active_user_for_sfdx_project:
    'Unable to retrieve active user for sfdx project',
  unable_to_query_for_existing_checkpoints:
    'Unable to query for existing checkpoints',
  unable_to_load_vscode_core_extension:
    'unable to load salesforce.salesforcedx-vscode-core extension',
  no_line_breakpoint_information_for_current_project:
    'There is no line breakpoint informatin for the current project',
  line_breakpoint_information_success:
    'Retrieved line breakpoint info from language server',
  language_client_not_ready:
    'Unable to retrieve breakpoint info from language server, language server is not ready',
  unable_to_retrieve_org_info: 'Unable to retrieve OrgInfo'
};
