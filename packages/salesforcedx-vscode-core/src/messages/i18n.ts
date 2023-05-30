/*
 * Copyright (c) 2017, salesforce.com, inc.
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
  channel_name: 'Salesforce CLI',
  channel_starting_message: 'Starting ',
  channel_end_with_exit_code: 'ended with exit code %s',
  channel_end_with_sfdx_not_found:
    'Salesforce CLI is not installed. Install it from https://developer.salesforce.com/tools/sfdxcli',
  channel_end_with_error: 'ended with error %s',
  channel_end: 'ended',

  progress_notification_text: 'Running %s',

  notification_successful_execution_text: '%s successfully ran',
  notification_canceled_execution_text: '%s was canceled',
  notification_unsuccessful_execution_text: '%s failed to run',
  notification_show_button_text: 'Show',
  notification_show_in_status_bar_button_text: 'Show Only in Status Bar',
  notification_make_default_dev: 'Authorize a Dev Hub',

  task_view_running_message: '[Running] %s',

  status_bar_text: `$(x) %s`,
  status_bar_tooltip: 'Click to cancel the command',
  status_bar_open_org_tooltip: 'Open Org',
  status_bar_org_picker_tooltip: 'Change Default Org',

  force_auth_web_login_authorize_dev_hub_text: 'SFDX: Authorize a Dev Hub',
  force_auth_web_login_authorize_org_text: 'SFDX: Authorize an Org',
  force_auth_access_token_authorize_org_text:
    'SFDX: Authorize an Org using Session ID',
  force_auth_access_token_login_bad_oauth_token_message:
    'The session ID that you are trying to use is not valid. Check if it has expired, or use a valid session ID.',
  force_auth_web_login_device_code_parse_error:
    'There was an unexpected error authorizing to your org in a container environment.',
  force_auth_device_login_enter_code:
    'Enter %s user code in the verification URL %s',
  action_required: '=== Action Required!',
  parameter_directory_strict_not_available:
    'A required metadata folder named "%s" does not exist in this workspace.',

  parameter_gatherer_enter_file_name: 'Enter desired filename',
  parameter_gatherer_enter_dir_name:
    'Enter desired directory (Press Enter to confirm or Esc to cancel)',
  parameter_gatherer_enter_lwc_name:
    'Enter desired Lightning Web Component (Press Enter to confirm or Esc to cancel)',
  parameter_gatherer_enter_username_name: 'Enter target username',
  parameter_gatherer_enter_alias_name:
    'Enter an org alias or use the default alias',
  parameter_gatherer_enter_custom_url:
    'Enter a custom login URL or use the default URL',
  parameter_gatherer_enter_instance_url: 'Enter Instance URL',
  parameter_gatherer_enter_session_id: 'Enter Session ID',
  parameter_gatherer_enter_session_id_placeholder: 'Session ID',
  parameter_gatherer_enter_session_id_diagnostic_message:
    'Enter a valid Session ID',
  parameter_gatherer_enter_scratch_org_def_files:
    'Select scratch definition file. Matched files with format: "config/**/*-scratch-def.json"',
  parameter_gatherer_enter_scratch_org_expiration_days:
    'Enter the number of days (1–30) until scratch org expiration or use the default value (7)',
  parameter_gatherer_enter_package_id: 'Enter the ID of the package to install',
  parameter_gatherer_enter_installation_key_if_necessary:
    'Enter the installation key, if required, or leave the field blank',
  parameter_gatherer_enter_project_name: 'Enter project name',
  parameter_gatherer_paste_forceide_url: 'Paste forceide:// URL from Setup',
  parameter_gatherer_paste_forceide_url_placeholder:
    'forceide:// URL from Setup',
  parameter_gatherer_invalid_forceide_url:
    "The forceide:// URL is invalid. From your subscriber's org, copy and paste the forceide:// URL shown on the Apex Debugger page in Setup.",
  parameter_gatherer_enter_function: 'Enter function details',
  parameter_gatherer_prompt_confirm_option: 'Continue',
  parameter_gatherer_prompt_cancel_option: 'Cancel',
  parameter_gatherer_placeholder_org_list_clean:
    'Confirm to continue removing deleted and expired scratch orgs',
  parameter_gatherer_placeholder_delete_selected_org:
    'Confirm to continue deleting the selected org',
  parameter_gatherer_placeholder_delete_default_org:
    'Confirm to continue deleting the default org',

  force_org_create_default_scratch_org_text:
    'SFDX: Create a Default Scratch Org...',
  force_org_create_result_parsing_error:
    'An unexpected error occurred while processing the org create response.',

  force_org_open_default_scratch_org_text: 'SFDX: Open Default Org',
  force_org_open_default_scratch_org_container_error:
    'There was an unexpected error when processing the org open response.',
  force_org_open_container_mode_message_text:
    'Access org %s as user %s with the following URL: %s',
  force_source_pull_default_org_text: 'SFDX: Pull Source from Default Org',
  force_source_pull_force_default_org_text:
    'SFDX: Pull Source from Default Org and Override Conflicts',
  force_source_push_default_org_text: 'SFDX: Push Source to Default Org',
  force_source_push_force_default_org_text:
    'SFDX: Push Source to Default Org and Override Conflicts',
  force_source_status_text: 'View All Changes (Local and in Default Org)',
  force_source_deploy_text: 'SFDX: Deploy Source to Org',
  force_source_deploy_select_file_or_directory:
    'You can run SFDX: Deploy Source to Org only on a source file or directory.',
  force_source_deploy_select_manifest:
    'You can run SFDX: Deploy Source in Manifest to Org only on a manifest file.',
  force_source_retrieve_text: 'SFDX: Retrieve Source from Org',
  force_source_retrieve_display_text: 'Retrieve Source from Org',
  force_source_retrieve_and_open_display_text: 'Retrieve and Open Source',
  force_source_retrieve_select_file_or_directory:
    'You can run SFDX: Retrieve Source from Org only on a source file or directory.',
  force_source_retrieve_select_manifest:
    'You can run SFDX: Retrieve Source in Manifest from Org only on a manifest file.',
  force_source_delete_text: 'SFDX: Delete from Project and Org',
  force_source_delete_manifest_unsupported_message:
    'SFDX: Delete from Project and Org is not supported for manifest files. Select a source file or directory to delete.',
  force_source_delete_select_file_or_directory:
    'You can run SFDX: Delete from Project and Org only on a source file or directory.',
  force_source_delete_confirmation_message:
    'Deleting source files deletes the files from your computer and removes the corresponding metadata from your default org. Are you sure you want to delete this source from your project and your org?',
  confirm_delete_source_button_text: 'Delete Source',
  cancel_delete_source_button_text: 'Cancel',
  force_analytics_template_create_text:
    'SFDX: Create Sample Analytics Template',
  force_analytics_template_name_text: 'template name',
  force_apex_class_create_text: 'SFDX: Create Apex Class',
  force_visualforce_component_create_text: 'SFDX: Create Visualforce Component',
  force_visualforce_page_create_text: 'SFDX: Create Visualforce Page',
  force_lightning_app_create_text: 'SFDX: Create Aura App',
  force_lightning_component_create_text: 'SFDX: Create Aura Component',
  force_lightning_event_create_text: 'SFDX: Create Aura Event',
  force_lightning_interface_create_text: 'SFDX: Create Aura Interface',
  force_function_create_text: 'SFDX: Create Function',
  force_function_containerless_start_text: 'SFDX: Start Local Function',
  force_create_manifest: 'SFDX: Generate Manifest File',
  force_function_start_no_org_auth:
    'No default org is set. We recommend that you select an active scratch org (SFDX: Set a Default Org) or create a new scratch org (SFDX: Authorize a Dev Hub, then SFDX: Create a Default Scratch Org).',
  force_function_start_warning_no_toml:
    'No project.toml found. Create a project.toml, or create a new function using SFDX: Create Function.',
  force_function_start_warning_not_in_function_folder:
    'Open a function file to run SFDX: Start Function',
  force_function_start_warning_plugin_not_installed:
    'To run this command, install the Salesforce Functions plugin. For more info, see [Getting Started with Salesforce Functions](https://developer.salesforce.com/docs/platform/functions/guide/set-up.html).',
  force_function_start_warning_docker_not_installed_or_not_started:
    'It looks like Docker is not installed or running. To run this command, install and start Docker Desktop from [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)',
  force_function_start_unexpected_error:
    'SFDX: Start Function exited unexpectedly',
  force_function_invoke_text: 'SFDX: Invoke Function',
  force_function_invoke_tooltip: 'Invoke',
  force_function_debug_invoke_tooltip: 'Debug Invoke',
  force_function_stop_text: 'SFDX: Stop Function',
  force_function_stop_in_progress: 'Stopping Function',
  force_function_stop_not_started: 'No Function is running locally',
  force_source_status_local_text: 'SFDX: View Local Changes',
  force_source_status_remote_text: 'SFDX: View Changes in Default Org',
  warning_prompt_file_overwrite:
    'One or more %s files with the specified path already exist in your workspace. Do you want to overwrite them?',
  warning_prompt_dir_overwrite:
    'A folder with the specified project name already exists in the selected directory. Do you want to overwrite it?',
  warning_prompt_continue_confirm: 'Continue',
  warning_prompt_overwrite_cancel: 'Cancel',
  warning_prompt_overwrite_message:
    'Are you sure you want to overwrite %s:%s?\n\n%s\n\n%s',
  warning_prompt_overwrite: 'Overwrite',
  warning_prompt_overwrite_all: 'Overwrite All',
  warning_prompt_skip: 'Skip',
  warning_prompt_skip_all: 'Skip All',
  warning_prompt_other_existing: '%s other existing components',
  warning_prompt_other_not_shown: '...%s other components not shown\n',
  force_config_list_text: 'SFDX: List All Config Variables',
  force_alias_list_text: 'SFDX: List All Aliases',
  force_org_delete_default_text: 'SFDX: Delete Default Org',
  force_org_delete_username_text: 'SFDX: Delete Org...',
  force_org_display_default_text: 'SFDX: Display Org Details for Default Org',
  force_org_display_username_text: 'SFDX: Display Org Details...',
  force_org_list_clean_text: 'SFDX: Remove Deleted and Expired Orgs',
  force_debugger_query_session_text: 'query for Apex Debugger session',
  force_debugger_stop_text: 'SFDX: Stop Apex Debugger Session',
  force_debugger_stop_none_found_text: 'No Apex Debugger session found.',
  force_data_soql_query_input_text: 'SFDX: Execute SOQL Query...',
  force_data_soql_query_selection_text:
    'SFDX: Execute SOQL Query with Currently Selected Text',
  parameter_gatherer_enter_soql_query: 'Enter the SOQL query',
  force_anon_apex_execute_document_text:
    'SFDX: Execute Anonymous Apex with Editor Contents',
  force_anon_apex_execute_selection_text:
    'SFDX: Execute Anonymous Apex with Currently Selected Text',
  force_package_install_text: 'SFDX: Install Package',
  force_project_create_text: 'SFDX: Create Project',
  force_project_create_open_dialog_create_label: 'Create Project',
  force_project_create_standard_template: 'Standard project template (default)',
  force_project_create_standard_template_display_text: 'Standard',
  force_project_create_empty_template_display_text: 'Empty',
  force_project_create_analytics_template_display_text: 'Analytics',
  force_project_create_empty_template: 'Empty project template',
  force_project_create_analytics_template: 'Analytics project template',
  force_apex_trigger_create_text: 'SFDX: Create Apex Trigger',
  force_start_apex_debug_logging:
    'SFDX: Turn On Apex Debug Log for Replay Debugger',
  force_apex_debug_log_status_bar_text:
    '$(file-text) Recording detailed logs until %s',
  force_apex_debug_log_status_bar_hover_text:
    'Writing debug logs for Apex and Visualforce at the %s log level until %s on %s',
  force_stop_apex_debug_logging:
    'SFDX: Turn Off Apex Debug Log for Replay Debugger',
  isv_debug_bootstrap_step1_create_project:
    'SFDX: ISV Debugger Setup, Step 1 of 7: Creating project',
  isv_debug_bootstrap_step2_configure_project:
    'SFDX: ISV Debugger Setup, Step 2 of 7: Configuring project',
  isv_debug_bootstrap_step2_configure_project_retrieve_namespace:
    'SFDX: ISV Debugger Setup, Step 2 of 7: Configuring project: Retrieving namespace',
  isv_debug_bootstrap_step3_retrieve_org_source:
    'SFDX: ISV Debugger Setup, Step 3 of 7: Retrieving unpackaged Apex code',
  isv_debug_bootstrap_step4_convert_org_source:
    'SFDX: ISV Debugger Setup, Step 4 of 7: Converting unpackaged Apex code',
  isv_debug_bootstrap_step5_list_installed_packages:
    'SFDX: ISV Debugger Setup, Step 5 of 7: Querying for installed packages',
  isv_debug_bootstrap_step6_retrieve_packages_source:
    'SFDX: ISV Debugger Setup, Step 6 of 7: Retrieving packages',
  isv_debug_bootstrap_step7_convert_package_source:
    'SFDX: ISV Debugger Setup, Step 7 of 7: Converting package: %s',
  isv_debug_bootstrap_processing_package: 'Processing package: %s',
  isv_debug_bootstrap_generate_launchjson: 'Creating launch configuration',
  isv_debug_bootstrap_open_project: 'Opening project in Visual Studio Code',

  error_creating_packagexml: 'Error creating package.xml. %s',
  error_extracting_org_source: 'Error extracting downloaded Apex source. %s',
  error_extracting_packages: 'Error extracting packages: %s',
  error_updating_sfdx_project: 'Error updating sfdx-project.json: %s',
  error_writing_installed_package_info:
    'Error writing installed-package.json: %s',
  error_cleanup_temp_files: 'Error cleaning up temporary files: %s',

  demo_mode_status_text: `$(gist-secret) SFDX DEMO`,
  demo_mode_status_tooltip:
    'You are running Salesforce Extensions for VS Code in demo mode. You will be prompted for confirmation when connecting to production orgs.',
  demo_mode_prompt:
    'Authorizing a business or production org is not recommended on a demo or shared machine. If you continue with the authentication, be sure to run "SFDX: Log Out from All Authorized Orgs" when you\'re done using this org.',
  force_auth_logout_all_text: 'SFDX: Log Out from All Authorized Orgs',
  force_auth_logout_default_text: 'SFDX: Log Out from Default Org',
  manifest_input_dupe_error:
    'Manifest with the name %s already exists. Delete this manifest or use another name.',
  manifest_input_save_placeholder:
    'Enter a unique manifest file name (without file extension)',
  manifest_input_save_prompt:
    'Press Enter to confirm your input or Escape to cancel and view unsaved manifest file',
  REST_API: 'REST API',
  tooling_API: 'Tooling API',
  REST_API_description: 'Execute the query with REST API',
  tooling_API_description: 'Execute the query with Tooling API',
  telemetry_legal_dialog_message:
    'You agree that Salesforce Extensions for VS Code may collect usage information, user environment, and crash reports for product improvements. Learn how to [opt out](%s).',
  telemetry_legal_dialog_button_text: 'Read more',
  invalid_debug_level_id_error:
    'At least one trace flag in your org doesn\'t have an associated debug level. Before you run this command again, run "sfdx force:data:soql:query -t -q "SELECT Id FROM TraceFlag WHERE DebugLevelId = null"". Then, to delete each invalid trace flag, run "sfdx force:data:record:delete -t -s TraceFlag -i 7tfxxxxxxxxxxxxxxx", replacing 7tfxxxxxxxxxxxxxxx with the ID of each trace flag without a debug level.',
  auth_project_label: 'Project Default',
  auth_project_detail: 'Use login URL defined in sfdx-project.json',
  auth_prod_label: 'Production',
  auth_prod_detail: 'login.salesforce.com',
  auth_sandbox_label: 'Sandbox',
  auth_sandbox_detail: 'test.salesforce.com',
  auth_custom_label: 'Custom',
  auth_custom_detail: 'Enter a custom login URL',
  auth_invalid_url: 'URL must begin with http:// or https://',
  auth_logout_scratch_prompt:
    'Log out of this scratch org?\n\nBefore logging out, ensure that you or someone on your team has a username and password for %s scratch org. Otherwise you might lose all access to this scratch org.',
  auth_logout_scratch_logout: 'Logout',
  auth_logout_no_default_org: 'No default org to logout from',
  error_fetching_auth_info_text:
    'Error running push or deploy on save: We couldn\'t connect to your default org. Run "SFDX: Create a Default Scratch Org" or "SFDX: Authorize an Org", then push or deploy the source that you just saved. Or, to disable push or deploy on save, set "salesforcedx-vscode-core.push-or-deploy-on-save.enabled" to false in your user or workspace settings for VS Code.',
  error_no_package_directories_found_on_setup_text:
    'Error setting up push or deploy on save: Your sfdx-project.json file doesn\'t contain a "packageDirectories" property. Add this property, or, to disable push or deploy on save, set "salesforcedx-vscode-core.push-or-deploy-on-save.enabled" to false in your user or workspace settings for VS Code. For details about sfdx-project.json, see: https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_config.htm',
  error_no_package_directories_paths_found_text:
    'Error setting up push or deploy on save: The "packageDirectories" property in your sfdx-project.json file doesn\'t contain a "path" value. Add a value for the "path" property, or, to disable push or deploy on save, set "salesforcedx-vscode-core.push-or-deploy-on-save.enabled" to false in your user or workspace settings for VS Code. For details about sfdx-project.json, see: https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_config.htm',
  error_push_or_deploy_on_save_no_default_username:
    'Error running push or deploy on save: No default org is set. Run "SFDX: Create a Default Scratch Org" or "SFDX: Authorize an Org", then push or deploy the changes that you just saved. Or, to disable push or deploy on save, set "salesforcedx-vscode-core.push-or-deploy-on-save.enabled" to false in your user or workspace settings for VS Code.',
  error_source_path_not_in_package_directory_text:
    'Error deploying or retrieving source: The file or directory that you tried to deploy or retrieve isn\'t in a package directory that\'s specified in your sfdx-project.json file. Add this location to your "packageDirectories" value, or deploy or retrieve a different file or directory. For details about sfdx-project.json, see: https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_config.htm',
  org_select_text: 'Select an org to set as default',
  org_expired: 'Expired',
  missing_default_org: 'No Default Org Set',
  force_config_set_org_text: 'SFDX: Set a Default Org',
  force_config_set_title: 'Set Config',
  table_header_name: 'Name',
  table_header_value: 'Value',
  table_header_success: 'Success',
  error_parsing_sfdx_project_file:
    "Couldn't parse sfdx-project.json file (%s). Parse error: %s",
  sfdx_cli_not_found:
    'Salesforce CLI is not installed. Install it from [%s](%s)',
  table_header_errors: 'ERRORS',
  table_header_project_path: 'PROJECT PATH',
  table_header_type: 'TYPE',
  table_header_full_name: 'FULL NAME',
  table_header_state: 'STATE',
  table_header_error_type: 'MESSAGE TYPE',
  table_header_message: 'MESSAGE',
  table_no_results_found: 'No results found',
  table_title_deployed_source: 'Deployed Source',
  table_title_deploy_errors: 'Deploy Errors',
  table_title_pulled_source: 'Pulled Source',
  table_title_pull_errors: 'Pull Errors',
  table_title_pushed_source: 'Pushed Source',
  table_title_push_errors: 'Push Errors',
  push_conflicts_error:
    'We couldn’t push your source due to conflicts. Make sure that you want to overwrite the metadata in your org with your local files, then run "SFDX: Push Source to Default Scratch Org and Override Conflicts".',
  pull_conflicts_error:
    'We couldn’t pull your source due to conflicts. Make sure that you want to overwrite the metadata in your local project, then run "SFDX: Pull Source to Default Scratch Org and Override Conflicts".',
  error_no_default_username:
    'No default org is set. Run "SFDX: Create a Default Scratch Org" or "SFDX: Authorize an Org" to set one.',
  error_no_default_devhubusername:
    'No default Dev Hub is set. Run "SFDX: Authorize a Dev Hub" to set one.',
  custom_output_directory: 'Choose a Custom Directory',
  warning_using_global_username:
    'No default username found in the local project config; using the global default username. Run "SFDX: Authorize an Org" to set the username for the local project config.',
  apex_class_message_name: 'Apex Class',
  apex_trigger_message_name: 'Apex Trigger',
  visualforce_component_message_name: 'Visualforce Component',
  visualforce_page_message_name: 'Visualforce Page',
  aura_bundle_message_name: 'Aura Bundle',
  lwc_message_name: 'Lightning Web Component',
  force_lightning_lwc_create_text: 'SFDX: Create Lightning Web Component',
  force_lightning_lwc_test_create_text:
    'SFDX: Create Lightning Web Component Test',
  empty_components: 'No components available',
  error_auth_token: 'Error refreshing authentication token.',
  error_no_org_found: 'No org authorization info found.',
  error_invalid_org_alias:
    'Alias can only contain underscores, spaces and alphanumeric characters',
  error_invalid_expiration_days: 'Number of days should be between 1 and 30',
  error_fetching_metadata: 'Error fetching metadata for org.',
  error_org_browser_text:
    'Run "SFDX: Authorize an Org" to authorize your org again.',
  error_org_browser_init: 'Org Browser has not been initialized',
  error_workspace_context_init: 'WorkspaceContext has not been initialized',
  error_overwrite_prompt: 'Error checking workspace for existing components',
  error_no_scratch_def:
    'No scratch definition files found. These files must be in the "config" folder and end with "-scratch-def.json". See [Scratch Org Definition File](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_scratch_orgs_def_file.htm) for help.',
  force_list_metadata: 'SFDX: Force List Metadata',
  apex_execute_compile_success: 'Compiled successfully.',
  apex_execute_runtime_success: 'Executed successfully.',
  apex_execute_text: 'Execute Anonymous Apex',
  force_apex_execute_library: 'Apex Library: Execute Anonymous',
  AccessControlPolicy: 'Access Control Policies',
  ActionLinkGroupTemplate: 'Action Link Group Templates',
  AIApplication: 'AI Applications',
  AIApplicationConfig: 'AI Application Configs',
  AIAssistantTemplate: 'AI Assistant Templates',
  ActionLauncherItemDef: 'Action Launcher Item Definitions',
  AnalyticSnapshot: 'Analytic Snapshots',
  AnimationRule: 'Animation Rules',
  ApexClass: 'Apex Classes',
  ApexComponent: 'Visualforce Components',
  ApexPage: 'Visualforce Pages',
  ApexTestSuite: 'Apex Test Suites',
  ApexTrigger: 'Apex Triggers',
  AppMenu: 'App Menus',
  AppointmentAssignmentPolicy: 'Appointment Assignment Policies',
  AppointmentSchedulingPolicy: 'Appointment Scheduling Policies',
  ApprovalProcess: 'Approval Processes',
  AssignmentRules: 'Assignment Rules',
  AssistantRecommendationType: 'Assistant Recommendation Types',
  Audience: 'Audiences',
  AuraDefinitionBundle: 'Aura Components',
  AuthProvider: 'Auth Providers',
  AutoResponseRules: 'Auto Response Rules',
  BatchProcessJobDefinition: 'Batch Process Job Definitions',
  BlacklistedConsumer: 'Blacklisted Consumers',
  BrandingSet: 'Branding Sets',
  BriefcaseDefinition: 'Briefcase Definitions',
  BusinessProcess: 'Business Processes',
  CallCenter: 'Call Centers',
  CallCenterRoutingMap: 'Call Center Routing Maps',
  CampaignInfluenceModel: 'Campaign Influence Models',
  CaseSubjectParticle: 'Case Subject Particles',
  Certificate: 'Certificates',
  ChannelLayout: 'Channel Layouts',
  ChatterExtension: 'Chatter Extensions',
  CleanDataService: 'Clean Data Services',
  CMSConnectSource: 'CMS Connect Sources',
  CommandAction: 'Command Actions',
  Community: 'Communities',
  CommunityTemplateDefinition: 'Community Template Definitions',
  CommunityThemeDefinition: 'Community Theme Definitions',
  CompactLayout: 'Compact Layouts',
  ConnectedApp: 'Connected Apps',
  ContentAsset: 'Content Assets',
  ConversationVendorInfo: 'Conversation Vendor Info',
  CorsWhitelistOrigin: 'Cors Whitelist Origins',
  CspTrustedSite: 'Csp Trusted Sites',
  CustomApplication: 'Custom Applications',
  CustomApplicationComponent: 'Custom Application Components',
  CustomDataType: 'Custom Data Types',
  CustomExperience: 'Custom Experiences',
  CustomFeedFilter: 'Custom Feed Filters',
  CustomField: 'Custom Fields',
  CustomFieldTranslation: 'Custom Field Translations',
  CustomHelpMenuSection: 'Custom Help Menu Sections',
  CustomIndex: 'Custom Indexes',
  CustomLabels: 'Custom Labels',
  CustomMetadata: 'Custom Metadatas',
  CustomNotificationType: 'Custom Notification Types',
  CustomObject: 'Custom Objects',
  CustomObjectTranslation: 'Custom Object Translations',
  CustomPageWebLink: 'Custom Page Web Links',
  CustomPermission: 'Custom Permissions',
  CustomSite: 'Custom Sites',
  CustomTab: 'Custom Tabs',
  Dashboard: 'Dashboards',
  DashboardFolder: 'Dashboard Folders',
  DataCategoryGroup: 'Data Category Groups',
  DataPipeline: 'Data Pipelines',
  DataWeaveResource: 'Data Category Resources',
  DelegateGroup: 'Delegate Groups',
  DigitalExperienceBundle: 'Digital Experience Bundles',
  DigitalExperienceConfig: 'Digital Experience Configs',
  Document: 'Documents',
  DocumentFolder: 'Document Folders',
  DuplicateRule: 'Duplicate Rules',
  EclairGeoData: 'Eclair Geo Datas',
  EmailFolder: 'Email Template Folders',
  EmailServicesFunction: 'Email Services Functions',
  EmailTemplate: 'Email Templates',
  EmbeddedServiceBranding: 'Embedded Service Brandings',
  EmbeddedServiceConfig: 'Embedded Service Configs',
  EmbeddedServiceFieldService: 'Embedded Service Field Services',
  EmbeddedServiceFlowConfig: 'Embedded Service Flow Configs',
  EmbeddedServiceLiveAgent: 'Embedded Service Live Agents',
  EntitlementProcess: 'Entitlement Processes',
  EntitlementTemplate: 'Entitlement Templates',
  EntityImplements: 'Entity Implements',
  EscalationRules: 'Escalation Rules',
  EventDelivery: 'Event Deliveries',
  EventRelayConfig: 'Event Relay Configs',
  EventSubscription: 'Event Subscriptions',
  EventType: 'Event Types',
  ExperienceBundle: 'Experience Bundles',
  ExperiencePropertyTypeBundle: 'Experience Property Type Bundles',
  ExternalCredential: 'External Credentials',
  ExternalDataSource: 'External Data Sources',
  ExternalServiceRegistration: 'External Service Registrations',
  FeatureParameterBoolean: 'Feature Parameter Booleans',
  FeatureParameterDate: 'Feature Parameter Dates',
  FeatureParameterInteger: 'Feature Parameter Integers',
  FieldRestrictionRule: 'Field Restriction Rules',
  FieldSet: 'Field Sets',
  FlexiPage: 'Flexi Pages',
  Flow: 'Flows',
  FlowTest: 'Flow Tests',
  FlowCategory: 'Flow Categories',
  FlowDefinition: 'Flow Definitions',
  Form: 'Forms',
  GatewayProviderPaymentMethodType: 'Gateway Provider Payment Method Types',
  GlobalPicklist: 'Global Picklists',
  GlobalValueSet: 'Global Value Sets',
  GlobalValueSetTranslation: 'Global Value Set Translations',
  Group: 'Groups',
  HomePageComponent: 'Home Page Components',
  HomePageLayout: 'Home Page Layouts',
  IframeWhiteListUrlSettings: 'Iframe White List Url Settings',
  Index: 'Indexes',
  InsightType: 'Insight Types',
  InstalledPackage: 'Installed Packages',
  IntegrationHubSettings: 'Integration Hub Settings',
  IntegrationHubSettingsType: 'Integration Hub Settings Types',
  IPAddressRange: 'IP Address Ranges',
  KeywordList: 'Keyword Lists',
  Layout: 'Layouts',
  LeadConvertSettings: 'Lead Convert Settings',
  Letterhead: 'Letterheads',
  LicenseDefinition: 'License Definitions',
  LightningBolt: 'Lightning Bolts',
  LightningComponentBundle: 'Lightning Web Components',
  LightningExperienceTheme: 'Lightning Experience Themes',
  ListView: 'List Views',
  LiveChatAgentConfig: 'Live Chat Agent Configs',
  LiveChatButton: 'Live Chat Buttons',
  LiveChatDeployment: 'Live Chat Deployments',
  LiveChatSensitiveDataRule: 'Live Chat Sensitive Data Rules',
  ManagedTopics: 'Managed Topics',
  MarketingResourceType: 'Marketing Resource Types',
  MatchingRules: 'Matching Rules',
  MilestoneType: 'Milestone Types',
  MLDataDefinition: 'ML Data Definitions',
  MLPredictionDefinition: 'ML Prediction Definitions',
  MLRecommendationDefinition: 'ML Recommendation Definitions',
  ModerationRule: 'Moderation Rules',
  NamedCredential: 'Named Credentials',
  NavigationMenu: 'Navigation Menu',
  Network: 'Networks',
  NetworkBranding: 'Network Brandings',
  OauthCustomScope: 'OAuth Custom Scopes',
  Orchestration: 'Orchestrations',
  OrchestrationContext: 'Orchestration Contexts',
  PathAssistant: 'Path Assistants',
  PermissionSet: 'Permission Sets',
  PermissionSetGroup: 'Permission Set Groups',
  PersonAccountOwnerPowerUser: 'Person Account Owner Power Users',
  PlatformCachePartition: 'Platform Cache Partitions',
  PlatformEventChannel: 'Platform Event Channels',
  PlatformEventSubscriberConfig: 'Platform Event Subscriber Configs',
  Portal: 'Portals',
  PortalDelegablePermissionSet: 'Portal Delegable Permission Sets',
  PostTemplate: 'Post Templates',
  PresenceDeclineReason: 'Presence Decline Reasons',
  PresenceUserConfig: 'Presence User Configs',
  ProductAttributeSet: 'Product Attribute Sets',
  Profile: 'Profiles',
  ProfilePasswordPolicy: 'Profile Password Policies',
  ProfileSessionSetting: 'Profile Session Settings',
  Prompt: 'Prompts',
  Queue: 'Queues',
  QueueRoutingConfig: 'Queue Routing Configs',
  QuickAction: 'Quick Actions',
  RecommendationStrategy: 'Recommendation Strategies',
  RecordActionDeployment: 'Record Action Deployments',
  RecordType: 'Record Types',
  RedirectWhitelistUrl: 'Redirect Whitelist Urls',
  RegisteredExternalService: 'Registered External Services',
  RemoteSiteSetting: 'Remote Site Settings',
  Report: 'Reports',
  ReportFolder: 'Report Folders',
  ReportType: 'Report Types',
  RestrictionRule: 'Restriction Rules',
  Role: 'Roles',
  SamlSsoConfig: 'Saml Sso Configs',
  Scontrol: 'Scontrols',
  SearchCustomization: 'Search Customizations',
  ServiceChannel: 'Service Channels',
  ServicePresenceStatus: 'Service Presence Status',
  Settings: 'Settings',
  SharingCriteriaRule: 'Sharing Criteria Rules',
  SharingOwnerRule: 'Sharing Owner Rules',
  SharingReason: 'Sharing Reasons',
  SharingRules: 'Sharing Rules',
  SharingSet: 'Sharing Sets',
  SharingTerritoryRule: 'Sharing Territory Rules',
  SiteDotCom: 'Sites',
  Skill: 'Skills',
  StandardValueSet: 'Standard Value Sets',
  StandardValueSetTranslation: 'Standard Value Set Translations',
  StaticResource: 'Static Resources',
  SynonymDictionary: 'Synonym Dictionaries',
  Territory2: 'Territory2',
  Territory2Model: 'Territory2 Models',
  Territory2Rule: 'Territory2 Rules',
  Territory2Type: 'Territory2 Types',
  Territory: 'Territories',
  TopicsForObjects: 'Topics For Objects',
  TransactionSecurityPolicy: 'Transaction Security Policies',
  Translations: 'Translations',
  UiPlugin: 'Ui Plugins',
  UserCriteria: 'User Criterias',
  UserProfileSearchScope: 'User Profile Search Scopes',
  ValidationRule: 'Validation Rules',
  VisualizationPlugin: 'Visualization Plugins',
  WaveApplication: 'Wave Applications',
  WaveDashboard: 'Wave Dashboards',
  WaveDataflow: 'Wave Dataflows',
  WaveDataset: 'Wave Datasets',
  WaveLens: 'Wave Lenses',
  WaveRecipe: 'Wave Recipes',
  WaveTemplateBundle: 'Wave Template Bundles',
  WaveXmd: 'Wave Xmds',
  WebLink: 'Web Links',
  Workflow: 'Workflows',
  XOrgHub: 'X Org Hubs',
  LightningMessageChannel: 'Lightning Message Channels',
  InboundNetworkConnection: 'Inbound Network Connections',
  OutboundNetworkConnection: 'Outbound Network Connections',
  MutingPermissionSet: 'Muting Permission Sets',
  MyDomainDiscoverableLogin: 'MyDomain Discoverable Login',
  UserProvisioningConfig: 'User Provisioning Configs',
  ApexEmailNotifications: 'Apex Email Notifications',
  PlatformEventChannelMember: 'Platform Event Channel Members',
  CanvasMetadata: 'Canvas Metadatas',
  MobileApplicationDetail: 'Mobile Application Details',
  NotificationTypeConfig: 'Notification Type Configs',
  LightningOnboardingConfig: 'Lightning Onboarding Configs',
  ManagedContentType: 'Managed Content Types',
  PaymentGatewayProvider: 'Payment Gateway Providers',
  EmbeddedServiceMenuSettings: 'Embedded Service Menu Settings',
  CallCoachingMediaProvider: 'Call Coaching Media Providers',

  conflict_detect_execution_name: 'Conflict Detection',
  conflict_detect_error:
    'An error was encountered during conflict detection. %s',
  conflict_detect_initialization_error:
    'Unexpected error initializing metadata cache',
  conflict_detect_conflicts_during_deploy:
    'Conflicts were detected while deploying metadata. Choose how to proceed.',
  conflict_detect_conflicts_during_retrieve:
    'Conflicts are detected while retrieving metadata. Select Override Conflicts to proceed or Cancel to view the conflicts.',
  conflict_detect_override: 'Override Conflicts and Deploy',
  conflict_detect_show_conflicts: 'View Conflicts and Cancel Deploy',
  conflict_detect_conflict_header:
    'Conflicts:\n    Found %s file(s) in conflict (scanned %s org files, %s local files):\n',
  conflict_detect_conflict_header_timestamp:
    'Conflicts:\n    Found %s file(s) in conflict:\n',
  conflict_detect_command_hint:
    '\nRun the following command to overwrite the conflicts:\n  %s',
  conflict_detect_no_default_username: 'No default username for this project',
  conflict_detect_no_default_package_dir:
    'No default package directory for this project',
  conflict_detect_view_init: 'Conflict detection view has not been initialized',
  conflict_detect_not_enabled:
    'Enable the Detect Conflicts at Sync setting to view org differences',
  conflict_detect_root_title: 'Org Differences',
  conflict_detect_view_root: '%s : %s file difference(s)',
  conflict_detect_no_conflicts: 'No conflicts',
  conflict_detect_no_differences: 'No differences',
  conflict_detect_diff_title: '%s//%s ↔ local//%s',
  conflict_detect_diff_command_title: 'Compare Files',
  conflict_detect_remote_last_modified_date: 'Org last modified date: %s \n',
  conflict_detect_local_last_modified_date: 'Local last sync date: %s',

  force_source_diff_text: 'SFDX: Diff File Against Org',
  force_source_diff_components_not_in_org:
    'Selected components are not available in the org',
  force_source_diff_unsupported_type:
    'Diff for this metadata type is currently not supported',
  force_source_diff_title: '%s//%s ↔ local//%s',
  force_source_diff_folder_title: '%s - File Diffs',
  beta_tapi_mdcontainer_error: 'Unexpected error creating metadata container',
  beta_tapi_membertype_error: 'Unexpected error creating %s member',
  beta_tapi_car_error: 'Unexpected error creating container async request',
  beta_tapi_queue_status: 'The deploy is still in the Queue',
  lib_retrieve_result_title: 'Retrieved Source',
  lib_retrieve_result_parse_error: 'Not able to parse current results.',
  lib_retrieve_message_title: 'Retrieve Warnings',
  package_id_validation_error:
    'Package ID should be a 15 or 18 character Id that starts with 04t',
  package_id_gatherer_placeholder: '04t...',
  force_function_enter_function: 'Enter a name for the function',
  force_function_enter_language: 'Select a language for your function',
  force_function_install_npm_dependencies_progress:
    'Installing NPM dependencies',
  force_function_install_npm_dependencies_error:
    "%s. Make sure you have NodeJS installed (https://nodejs.org/) and then run 'npm install' to install dependencies from package.json",
  force_function_install_mvn_dependencies_error:
    "%s. Make sure you have Maven installed (https://maven.apache.org/) and then run 'mvn install' to install dependencies from pom.xml",
  sobjects_refresh_needed:
    "You don't have any sObjects cached locally. To take advantage of autocompletion for sObjects in Apex code, run SFDX: Refresh SObject Definitions.",
  sobjects_refresh_now: 'Run SFDX: Refresh SObject Definitions',
  force_sobjects_refresh: 'SFDX: Refresh SObject Definitions',
  sobject_refresh_all: 'All SObjects',
  sobject_refresh_custom: 'Custom SObjects',
  sobject_refresh_standard: 'Standard SObjects',
  force_sobjects_no_refresh_if_already_active_error_text:
    'A refresh of your sObject definitions is already underway. If you need to restart the process, cancel the running task.',
  force_rename_lightning_component: 'SFDX: Rename Component',
  rename_component_input_dup_error:
    'Component name is already in use in LWC or Aura',
  rename_component_input_dup_file_name_error:
    'This file name is already in use in the current component directory. Choose a different name and try again.',
  rename_component_input_placeholder: 'Enter a unique component name',
  rename_component_input_prompt:
    'Press Enter to confirm your input or Escape to cancel',
  rename_component_warning:
    'Warning: References to the old name will not be updated. Update manually and redeploy once all changes have been made.',
  rename_component_error:
    'Unable to rename the component. Try renaming the component manually and then redeploying your changes.',
  error_function_type: 'Unable to determine type of executing function.',
  error_unable_to_get_started_function:
    'Unable to access the function in "{0}".',
  pending_org_expiration_expires_on_message: '%s\n(expires on %s)',
  pending_org_expiration_notification_message:
    'Warning: One or more of your orgs expire in the next %s days. For more details, review the Output panel.',
  pending_org_expiration_output_channel_message:
    'Warning: The following orgs expire in the next %s days:\n\n%s\n\nIf these orgs contain critical data or settings, back them up before the org expires.',
  aura_doc_url: 'https://developer.salesforce.com/tools/vscode/en/aura/writing',
  apex_doc_url: 'https://developer.salesforce.com/tools/vscode/en/apex/writing',
  soql_doc_url:
    'https://developer.salesforce.com/tools/vscode/en/soql/soql-builder',
  lwc_doc_url: 'https://developer.salesforce.com/tools/vscode/en/lwc/writing',
  functions_doc_url:
    'https://developer.salesforce.com/tools/vscode/en/functions/overview',
  default_doc_url: 'https://developer.salesforce.com/tools/vscode',
  parameter_gatherer_file_name_max_length_validation_error_message:
    'File name cannot exceed {0} characters',
  source_status: 'Source Status'
};
