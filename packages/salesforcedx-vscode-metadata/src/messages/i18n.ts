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
  source_tracking_status_bar_click_to_deploy_then_retrieve:
    '💡 Click to deploy local changes then retrieve remote changes',
  source_tracking_status_bar_click_to_view_conflicts: '💡 Click to view conflicts',
  source_tracking_status_bar_view_changes: 'View Changes',
  source_tracking_status_bar_no_changes: 'No changes (Org and project are in sync)',
  source_tracking_status_bar_refreshing: 'Refreshing source tracking...',
  source_tracking_conflict_detection_disabled_tooltip:
    'Conflict detection is disabled. Local and remote change tracking is not active. Enable it in settings: `salesforcedx-vscode-metadata.sourceTracking.enableConflictDetection`',
  deploy_completed_with_errors_message: 'Deploy completed with errors. Check output for details.',
  deploy_this_source_text: 'SFDX: Deploy This Source to Org',
  deploy_in_manifest_text: 'SFDX: Deploy Source in Manifest to Org',
  deploy_select_file_or_directory: 'You can run SFDX: Deploy This Source to Org only on a source file or directory.',
  deploy_select_manifest: 'You can run SFDX: Deploy Source in Manifest to Org only on a manifest file.',

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
  project_deploy_start_default_org_text: 'SFDX: Push Source to Default Org',
  project_deploy_start_ignore_conflicts_default_org_text: 'SFDX: Push Source to Default Org and Ignore Conflicts',
  project_retrieve_start_default_org_text: 'SFDX: Pull Source from Default Org',
  project_retrieve_start_ignore_conflicts_default_org_text: 'SFDX: Pull Source from Default Org and Ignore Conflicts',
  parameter_gatherer_enter_project_name: 'Enter project name',
  no_remote_changes_to_retrieve: 'No remote changes to retrieve.',
  no_local_changes_to_deploy: 'No local changes to deploy.',
  command_succeeded_text: '%s succeeded.',
  deploy_source_conflicts_detected: 'Conflicts detected. Resolve conflicts before deploying. \n Conflicts: %s',
  delete_source_text: 'SFDX: Delete from Project and Org',
  delete_source_select_file_or_directory:
    'You can run SFDX: Delete from Project and Org only on a source file or directory.',
  delete_source_confirmation_message:
    'Deleting source files deletes the files from your computer and removes the corresponding metadata from your default org. Are you sure you want to delete this source from your project and your org?',
  confirm_delete_source_button_text: 'Delete Source',
  cancel_delete_source_button_text: 'Cancel',
  delete_source_operation_failed: 'Delete operation failed: %s',
  delete_completed_with_errors_message: 'Delete completed with errors. Check output for details.',
  manifest_input_save_placeholder: 'Enter a unique manifest file name (without file extension)',
  manifest_input_save_prompt: 'Press Enter to confirm your input or Escape to cancel and view unsaved manifest file',
  manifest_file_name_empty_error: 'File name cannot be empty',
  manifest_file_name_format_error:
    'File name must start with a letter and contain only alphanumeric characters and underscores',
  project_generate_text: 'SFDX: Create Project',
  project_generate_open_dialog_create_label: 'Create Project',
  project_generate_standard_template_display_text: 'Standard',
  project_generate_empty_template_display_text: 'Empty',
  project_generate_analytics_template_display_text: 'Analytics',
  project_generate_react_b2e_template_display_text: 'React Internal App',
  project_generate_react_b2x_template_display_text: 'React External App',
  project_generate_agent_template_display_text: 'Agent',
  project_generate_empty_template: 'Empty project template',
  project_generate_standard_template: 'Standard project template',
  project_generate_analytics_template: 'Analytics project template',
  project_generate_react_b2e_template:
    'For employees signing in with Salesforce credentials (B2E). Sample app: Property Management App.',
  project_generate_react_b2x_template:
    'For customers or partners signing in outside your org (B2C). Sample app: Property Rental App.',
  project_generate_agent_template: 'Agent project template',
  project_generate_manifest_text: 'SFDX: Generate Manifest File',
  analytics_generate_template_text: 'SFDX: Create Sample Analytics Template',
  analytics_template_name_text: 'template name',
  analytics_output_dir_prompt: 'Select Analytics template output directory',
  generate_manifest_select_file_or_directory:
    'You can run SFDX: Generate Manifest File only on a source file or directory.',
  source_diff_unsupported_type: 'Diff for this metadata type is currently not supported',
  source_diff_title: '%s//%s ↔ local//%s',
  source_diff_failed: 'Diff failed: %s',
  source_diff_no_results: 'No components retrieved from org',
  source_diff_no_matching_files: 'No matching files found to diff',
  source_diff_all_files_match: 'All Files Match',
  missing_default_org: 'No default org is set. Run "SFDX: Authorize an Org" to set a default org.',

  // Conflict detection
  conflict_detect_diff_title: '%s//%s ↔ local//%s',
  conflict_detect_diff_command_title: 'Compare Files',
  conflict_detect_open_file: 'Open File',
  conflict_detect_resolve_view: 'Org Differences',
  conflicts_view_title_text: 'Org Differences',
  conflict_detect_conflicts_during_deploy:
    'Conflicts were detected while deploying metadata to your org. What would you like to do?',
  conflict_detect_conflicts_during_retrieve:
    'Conflicts are detected while retrieving metadata from your org. What would you like to do?',
  conflict_detect_override_deploy: 'Override Conflicts and Deploy',
  conflict_detect_override_retrieve: 'Override Conflicts and Retrieve',
  conflict_detect_override_delete: 'Override Conflicts and Delete',
  conflict_detect_show_conflicts_deploy: 'View Conflicts and Cancel Deploy',
  conflict_detect_show_conflicts_retrieve: 'View Conflicts and Cancel Retrieve',
  conflict_detect_show_conflicts_delete: 'View Conflicts and Cancel Delete',
  conflict_detect_conflicts_during_delete:
    'Conflicts were detected while deleting metadata from your org. What would you like to do?',
  conflict_detect_no_conflicts: 'No conflicts',
  conflict_detect_no_differences: 'No differences',
  conflict_detection_enabled_description:
    'When enabled, the system will check for conflicts before deploying/retrieving.',

  // Preparation phase progress
  preparing_deployment: 'Preparing deployment...',
  preparing_retrieval: 'Preparing retrieval...',
  preparing_deletion: 'Preparing deletion...',
  checking_for_conflicts: 'Checking for conflicts...',

  // SObject refresh
  sobjects_refresh: 'SFDX: Refresh SObject Definitions',
  sobject_refresh_all: 'All SObjects',
  sobject_refresh_custom: 'Custom SObjects',
  sobject_refresh_standard: 'Standard SObjects',
  sobjects_no_refresh_if_already_active_error_text:
    'A refresh of your sObject definitions is already underway. If you need to restart the process, cancel the running task.',
  processed_sobjects_length_text: 'Processed %d %s sObjects\n',

  // Project info
  project_info_text: 'SFDX: Generate Project Info',
  project_info_written_message: 'Project info written to .sf/project-info.md',
  project_info_gathering_progress: 'Gathering project info...',
  open_button: 'Open',

  // Package install
  package_install_text: 'SFDX: Install Package',
  package_install_id_prompt: 'Enter the ID of the package to install',
  package_install_id_placeholder: '04t...',
  package_install_id_validation: 'Package ID should be a 15 or 18 character Id that starts with 04t',
  package_install_key_prompt: 'Installation key for key-protected package (leave blank for unprotected packages)',
  package_install_poll_prompt: 'Wait for package installation to complete?',
  package_install_poll_yes: 'Yes',
  package_install_poll_no: 'No',
  package_install_polling_progress: 'Installing package %s...',
  package_install_submitted_message: 'Package install request submitted. Request Id: %s',
  package_install_succeeded_message: 'Package %s installed successfully.',
  package_install_cancelled_message: 'Polling cancelled. Install continues on the server. Request Id: %s',
  package_install_failed_message: 'Package install failed: %s'
} as const;

export type MessageKey = keyof typeof messages;
