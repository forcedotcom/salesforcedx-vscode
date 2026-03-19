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
  apex_class_name_cannot_be_default: 'Class name cannot be "default"',
  apex_class_name_empty_error: 'Class name cannot be empty',
  apex_class_name_format_error:
    'Class name must start with a letter and contain only alphanumeric characters and underscores',
  apex_class_name_max_length_error: 'Class name cannot exceed %d characters',
  apex_class_name_prompt: 'Enter Apex class name',
  apex_class_name_placeholder: 'MyApexClass',
  apex_class_output_dir_prompt: 'Select output directory',
  apex_class_template_prompt: 'Select template type',
  apex_class_default_template_description: 'Standard Apex class with constructor',
  apex_class_exception_template_description: 'Custom exception class',
  apex_class_inbound_email_template_description: 'Inbound email service handler',
  apex_generate_class_success: 'Apex class created successfully',
  lwc_component_name_empty_error: 'Component name cannot be empty',
  lwc_component_name_format_error:
    'Component name must start with a letter and contain only alphanumeric characters and underscores',
  lwc_component_name_prompt: 'Enter Lightning Web Component name',
  lwc_component_name_placeholder: 'myComponent',
  lwc_output_dir_prompt: 'Select output directory',
  lwc_select_component_type: 'Select component type',
  lwc_generate_success: 'Lightning Web Component created successfully',
  lwc_already_exists: 'Component already exists. Do you want to overwrite it?',
  deploy_completed_with_errors_message: 'Deploy completed with errors. Check output for details.',
  deploy_this_source_text: 'SFDX: Deploy This Source to Org',
  deploy_in_manifest_text: 'SFDX: Deploy Source in Manifest to Org',
  deploy_select_file_or_directory: 'You can run SFDX: Deploy This Source to Org only on a source file or directory.',
  deploy_select_manifest: 'You can run SFDX: Deploy Source in Manifest to Org only on a manifest file.',

  // Deploy on save
  deploy_on_save_error_no_target_org:
    'Error running deploy on save: No default org is set. Run "SFDX: Authorize an Org", then deploy the changes that you just saved.',
  deploy_on_save_error_generic: 'Deploy on save failed: %s',
  deploy_failed: 'Failed to deploy: %s',
  retrieve_this_source_text: 'SFDX: Retrieve This Source from Org',
  retrieve_in_manifest_text: 'SFDX: Retrieve Source in Manifest from Org',
  retrieve_select_file_or_directory:
    'You can run SFDX: Retrieve This Source from Org only on a source file or directory.',
  retrieve_select_manifest: 'You can run SFDX: Retrieve Source in Manifest from Org only on a manifest file.',
  retrieve_completed_with_errors_message: 'Retrieve completed with errors. Check output for details.',
  no_remote_changes_to_retrieve: 'No remote changes to retrieve.',
  no_local_changes_to_deploy: 'No local changes to deploy.',
  retrieve_source_conflicts_detected: 'Conflicts detected. Resolve conflicts before retrieving. \n Conflicts: %s',
  error_source_tracking_components_failed: 'Failed to retrieve components using source tracking: %s',
  delete_source_text: 'SFDX: Delete from Project and Org',
  delete_source_select_file_or_directory:
    'You can run SFDX: Delete from Project and Org only on a source file or directory.',
  delete_source_confirmation_message:
    'Deleting source files deletes the files from your computer and removes the corresponding metadata from your default org. Are you sure you want to delete this source from your project and your org?',
  confirm_delete_source_button_text: 'Delete Source',
  cancel_delete_source_button_text: 'Cancel',
  delete_source_conflicts_detected: 'Conflicts detected. Resolve conflicts before deleting.',
  delete_source_operation_failed: 'Delete operation failed',
  delete_completed_with_errors_message: 'Delete completed with errors. Check output for details.',
  delete_failed: 'Failed to delete: %s',
  manifest_input_save_placeholder: 'Enter a unique manifest file name (without file extension)',
  manifest_input_save_prompt: 'Press Enter to confirm your input or Escape to cancel and view unsaved manifest file',
  manifest_overwrite_confirmation: 'Manifest file "%s" already exists. Do you want to overwrite it?',
  project_generate_manifest_text: 'SFDX: Generate Manifest File',
  generate_manifest_select_file_or_directory:
    'You can run SFDX: Generate Manifest File only on a source file or directory.',
  source_diff_unsupported_type: 'Diff for this metadata type is currently not supported',
  source_diff_title: '%s//%s ↔ local//%s',
  source_diff_failed: 'Diff failed: %s',
  source_diff_failed_for_file: 'Diff failed for %s: %s',
  source_diff_cancelled: 'Diff cancelled by user',
  source_diff_no_results: 'No components retrieved from org',
  source_diff_no_matching_files: 'No matching files found to diff',
  source_diff_all_files_match: 'All Files Match',
  missing_default_org: 'No default org is set. Run "SFDX: Authorize an Org" to set a default org.',
  overwrite_button: 'Overwrite',
  cancel_button: 'Cancel',

  // SObject refresh
  sobjects_refresh: 'SFDX: Refresh SObject Definitions',
  sobject_refresh_all: 'All SObjects',
  sobject_refresh_custom: 'Custom SObjects',
  sobject_refresh_standard: 'Standard SObjects',
  sobjects_no_refresh_if_already_active_error_text:
    'A refresh of your sObject definitions is already underway. If you need to restart the process, cancel the running task.',
  processed_sobjects_length_text: 'Processed %d %s sObjects\n'
} as const;

export type MessageKey = keyof typeof messages;
