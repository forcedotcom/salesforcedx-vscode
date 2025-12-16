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
  // Source tracking output channel headings
  source_tracking_title_all_changes: 'Source Tracking Details',
  source_tracking_title_local_changes: 'Local Changes',
  source_tracking_title_remote_changes: 'Remote Changes',
  source_tracking_section_local_changes: 'Local Changes',
  source_tracking_section_remote_changes: 'Remote Changes',
  source_tracking_section_conflicts: 'Conflicts',

  // Status bar messages
  source_tracking_status_bar_local_changes: 'Local Changes',
  source_tracking_status_bar_remote_changes: 'Remote Changes',
  source_tracking_status_bar_conflicts: 'Conflicts',
  source_tracking_status_bar_click_to_push: '💡 Click to deploy these changes to the org',
  source_tracking_status_bar_click_to_retrieve: '💡 Click to retrieve these changes from the org',
  source_tracking_status_bar_click_to_view_details: '💡 Click to view full details in the output channel',
  source_tracking_status_bar_no_changes: 'No changes (Org and project are in sync)',
  apex_class_name_prompt: 'Enter Apex class name',
  apex_class_name_placeholder: 'MyApexClass',
  apex_class_output_dir_prompt: 'Select output directory',
  apex_class_already_exists: 'One or more files already exist. Do you want to overwrite them?',
  apex_generate_class_success: 'Apex class created successfully',
  deploy_no_local_changes_message: 'No local changes to deploy',
  deploy_no_components_message: 'No components found to deploy',
  deploy_completed_with_errors_message: 'Deploy completed with errors. Check output for details.',
  deploy_this_source_text: 'SFDX: Deploy This Source to Org',
  deploy_in_manifest_text: 'SFDX: Deploy Source in Manifest to Org',
  deploy_select_file_or_directory: 'You can run SFDX: Deploy This Source to Org only on a source file or directory.',
  deploy_select_manifest: 'You can run SFDX: Deploy Source in Manifest to Org only on a manifest file.',
  failed_to_create_apex_class: 'Failed to create Apex class: %s',

  // Deploy on save
  deploy_on_save_error_no_target_org:
    'Error running deploy on save: No default org is set. Run "SFDX: Authorize an Org", then deploy the changes that you just saved.',
  deploy_on_save_error_generic: 'Deploy on save failed: %s'
} as const;

export type MessageKey = keyof typeof messages;
