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
 * If ommitted, we will assume _message.
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

  predicates_no_folder_opened_text:
    'No folder opened. Open a Salesforce DX project in VS Code.',
  predicates_no_sfdx_project_found_text:
    'No sfdx-project.json found in the root directory of your open project. Open a Salesforce DX project in VS Code.',

  task_view_running_message: '[Running] %s',

  status_bar_text: `$(x) %s`,
  status_bar_tooltip: 'Click to cancel the command',

  force_auth_web_login_authorize_dev_hub_text: 'SFDX: Authorize a Dev Hub',
  force_auth_web_login_authorize_org_text: 'SFDX: Authorize an Org',

  parameter_directory_strict_not_available:
    'A required metadata folder named "%s" does not exist in this workspace.',

  parameter_gatherer_enter_file_name: 'Enter desired filename',
  parameter_gatherer_enter_dir_name:
    'Enter desired directory (Press Enter to confirm or Esc to cancel)',
  parameter_gatherer_enter_username_name: 'Enter target username',
  parameter_gatherer_enter_alias_name:
    'Enter an org alias or use the default alias',
  parameter_gatherer_enter_custom_url:
    'Enter a custom login URL or use the default URL',
  parameter_gatherer_enter_scratch_org_def_files:
    'Select scratch definition file. Matched files with format: "config/**/*-scratch-def.json"',
  parameter_gatherer_enter_scratch_org_expiration_days:
    'Enter the number of days (1–30) until scratch org expiration or use the default value (7)',
  parameter_gatherer_enter_project_name: 'Enter project name',
  parameter_gatherer_paste_forceide_url: 'Paste forceide:// URL from Setup',
  parameter_gatherer_paste_forceide_url_placeholder:
    'forceide:// URL from Setup',
  parameter_gatherer_invalid_forceide_url:
    "The forceide:// URL is invalid. From your subscriber's org, copy and paste the forceide:// URL shown on the Apex Debugger page in Setup.",

  force_org_create_default_scratch_org_text:
    'SFDX: Create a Default Scratch Org...',
  force_org_create_result_parsing_error:
    'An unexpected error occurred while processing the org create response.',

  force_org_open_default_scratch_org_text: 'SFDX: Open Default Org',
  force_org_open_default_scratch_org_container_error:
    'There was an unexpected error when processing the org open response.',
  force_org_open_container_mode_message_text:
    'Access org %s as user %s with the following URL: %s',

  force_source_pull_default_scratch_org_text:
    'SFDX: Pull Source from Default Scratch Org',
  force_source_pull_force_default_scratch_org_text:
    'SFDX: Pull Source from Default Scratch Org and Override Conflicts',

  force_source_push_default_scratch_org_text:
    'SFDX: Push Source to Default Scratch Org',
  force_source_push_force_default_scratch_org_text:
    'SFDX: Push Source to Default Scratch Org and Override Conflicts',

  force_source_deploy_text: 'SFDX: Deploy Source to Org',
  force_source_deploy_select_file_or_directory:
    'You can run SFDX: Deploy Source to Org only on a source file or directory.',
  force_source_deploy_select_manifest:
    'You can run SFDX: Deploy Source in Manifest to Org only on a manifest file.',
  force_source_retrieve_text: 'SFDX: Retrieve Source from Org',
  force_source_retrieve_display_text: 'Retrieve Source from Org',
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

  force_source_status_text:
    'View All Changes (Local and in Default Scratch Org)',

  force_apex_test_run_text: 'SFDX: Invoke Apex Tests...',
  force_apex_test_run_all_test_label: 'All tests',
  force_apex_test_run_all_tests_description_text:
    'Runs all tests in the current project',

  force_analytics_template_create_text:
    'SFDX: Create Sample Analytics Template',
  force_analytics_template_name_text: 'template name',
  force_apex_class_create_text: 'SFDX: Create Apex Class',
  force_visualforce_component_create_text: 'SFDX: Create Visualforce Component',
  force_visualforce_page_create_text: 'SFDX: Create Visualforce Page',
  force_lightning_app_create_text: 'SFDX: Create Lightning App',
  force_lightning_component_create_text: 'SFDX: Create Lightning Component',
  force_lightning_event_create_text: 'SFDX: Create Lightning Event',
  force_lightning_interface_create_text: 'SFDX: Create Lightning Interface',
  force_source_status_local_text: 'SFDX: View Local Changes',
  force_source_status_remote_text: 'SFDX: View Changes in Default Scratch Org',
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
  force_org_display_default_text: 'SFDX: Display Org Details for Default Org',
  force_org_display_username_text: 'SFDX: Display Org Details...',
  force_debugger_query_session_text: 'query for Apex Debugger session',
  force_debugger_stop_text: 'SFDX: Stop Apex Debugger Session',
  force_debugger_stop_none_found_text: 'No Apex Debugger session found.',
  force_data_soql_query_input_text: 'SFDX: Execute SOQL Query...',
  force_data_soql_query_selection_text:
    'SFDX: Execute SOQL Query with Currently Selected Text',
  parameter_gatherer_enter_soql_query: 'Enter the SOQL query',
  force_apex_execute_document_text:
    'SFDX: Execute Anonymous Apex with Editor Contents',
  force_apex_execute_selection_text:
    'SFDX: Execute Anonymous Apex with Currently Selected Text',
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
  isv_debug_bootstrap_open_project:
    'Opening project in new Visual Studio Code window',

  force_apex_log_get_text: 'SFDX: Get Apex Debug Logs...',
  force_apex_log_get_no_logs_text: 'No Apex debug logs were found',
  force_apex_log_get_pick_log_text: 'Pick an Apex debug log to get',
  force_apex_log_list_text: 'Getting Apex debug logs',

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
  manifest_editor_title_message: 'Manifest Editor',
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
  missing_default_org: 'No Default Org Set',
  force_config_set_org_text: 'SFDX: Set a Default Org',
  error_parsing_sfdx_project_file:
    "Couldn't parse sfdx-project.json file (%s). Parse error: %s",
  sfdx_cli_not_found:
    'Salesforce CLI is not installed. Install it from [%s](%s)',
  table_header_errors: 'ERRORS',
  table_header_project_path: 'PROJECT PATH',
  table_header_type: 'TYPE',
  table_header_full_name: 'FULL NAME',
  table_header_state: 'STATE',
  table_no_results_found: 'No results found',
  table_title_deployed_source: 'Deployed Source',
  table_title_deploy_errors: 'Deploy Errors',
  table_title_pushed_source: 'Pushed Source',
  table_title_push_errors: 'Push Errors',
  push_conflicts_error:
    'We couldn’t push your source due to conflicts. Make sure that you want to overwrite the metadata in your org with your local files, then run "SFDX: Push Source to Default Scratch Org and Override Conflicts".',
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
  error_overwrite_prompt: 'Error checking workspace for existing components',
  error_no_scratch_def:
    'No scratch definition files found. These files must be in the "config" folder and have file names that end with "-scratch-def.json". See [Scratch Org Definition File](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_scratch_orgs_def_file.htm) for help.',
  force_list_metadata: 'SFDX: Force List Metadata',

  AccessControlPolicy: 'Access Control Policies',
  ActionLinkGroupTemplate: 'Action Link Group Templates',
  AIAssistantTemplate: 'AI Assistant Templates',
  AnalyticSnapshot: 'Analytic Snapshots',
  AnimationRule: 'Animation Rules',
  ApexClass: 'Apex Classes',
  ApexComponent: 'Visualforce Components',
  ApexPage: 'Visualforce Pages',
  ApexTestSuite: 'Apex Test Suites',
  ApexTrigger: 'Apex Triggers',
  AppMenu: 'App Menus',
  ApprovalProcess: 'Approval Processes',
  AssignmentRules: 'Assignment Rules',
  AssistantRecommendationType: 'Assistant Recommendation Types',
  AuraDefinitionBundle: 'Aura Components',
  AuthProvider: 'Auth Providers',
  AutoResponseRules: 'Auto Response Rules',
  BrandingSet: 'Branding Sets',
  BusinessProcess: 'Business Processes',
  CallCenter: 'Call Centers',
  CampaignInfluenceModel: 'Campaign Influence Models',
  CaseSubjectParticle: 'Case Subject Particles',
  Certificate: 'Certificates',
  ChannelLayout: 'Channel Layouts',
  ChatterExtension: 'Chatter Extensions',
  CleanDataService: 'Clean Data Services',
  CommandAction: 'Command Actions',
  Community: 'Communities',
  CommunityTemplateDefinition: 'Community Template Definitions',
  CommunityThemeDefinition: 'Community Theme Definitions',
  CompactLayout: 'Compact Layouts',
  ConnectedApp: 'Connected Apps',
  ContentAsset: 'Content Assets',
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
  DelegateGroup: 'Delegate Groups',
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
  EscalationRules: 'Escalation Rules',
  EventDelivery: 'Event Deliveries',
  EventSubscription: 'Event Subscriptions',
  EventType: 'Event Types',
  ExperienceBundle: 'Experience Bundles',
  ExternalDataSource: 'External Data Sources',
  ExternalServiceRegistration: 'External Service Registrations',
  FeatureParameterBoolean: 'Feature Parameter Booleans',
  FeatureParameterDate: 'Feature Parameter Dates',
  FeatureParameterInteger: 'Feature Parameter Integers',
  FieldSet: 'Field Sets',
  FlexiPage: 'Flexi Pages',
  Flow: 'Flows',
  FlowCategory: 'Flow Categories',
  FlowDefinition: 'Flow Definitions',
  Form: 'Forms',
  GlobalPicklist: 'Global Picklists',
  GlobalValueSet: 'Global Value Sets',
  GlobalValueSetTranslation: 'Global Value Set Translations',
  Group: 'Groups',
  HomePageComponent: 'Home Page Components',
  HomePageLayout: 'Home Page Layouts',
  Index: 'Indexes',
  InsightType: 'Insight Types',
  InstalledPackage: 'Installed Packages',
  IntegrationHubSettings: 'Integration Hub Settings',
  IntegrationHubSettingsType: 'Integration Hub Settings Types',
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
  ModerationRule: 'Moderation Rules',
  NamedCredential: 'Named Credentials',
  Network: 'Networks',
  NetworkBranding: 'Network Brandings',
  OauthCustomScope: 'OAuth Custom Scopes',
  Orchestration: 'Orchestrations',
  OrchestrationContext: 'Orchestration Contexts',
  PathAssistant: 'Path Assistants',
  PermissionSet: 'Permission Sets',
  PermissionSetGroup: 'Permission Set Groups',
  PlatformCachePartition: 'Platform Cache Partitions',
  PlatformEventChannel: 'Platform Event Channels',
  Portal: 'Portals',
  PostTemplate: 'Post Templates',
  PresenceDeclineReason: 'Presence Decline Reasons',
  PresenceUserConfig: 'Presence User Configs',
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
  RemoteSiteSetting: 'Remote Site Settings',
  Report: 'Reports',
  ReportFolder: 'Report Folders',
  ReportType: 'Report Types',
  Role: 'Roles',
  SamlSsoConfig: 'Saml Sso Configs',
  Scontrol: 'Scontrols',
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

  conflict_detect_error:
    'An error was encountered during conflict detection. %s',
  conflict_detect_retrieve_org_source:
    'Conflict Detection: retrieving org source',
  conflict_detect_convert_org_source:
    'Conflict Detection: converting org source',
  conflict_detect_conflicts_during_deploy:
    'Conflicts are detected while deploying metadata. Select Override Conflicts to proceed or Cancel to view the conflicts.',
  conflict_detect_conflicts_during_retrieve:
    'Conflicts are detected while retrieving metadata. Select Override Conflicts to proceed or Cancel to view the conflicts.',
  conflict_detect_override: 'Override Conflicts',
  conflict_detect_show_conflicts: 'Show Conflicts',
  conflict_detect_conflict_header:
    'Conflicts:\n    Found %s file(s) in conflict (scanned %s org files, %s local files):\n',
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
  conflict_detect_diff_title: '%s//%s ↔ local//%s',
  conflict_detect_diff_command_title: 'Compare Files',

  force_source_diff_text: 'SFDX: Diff File Against Org',
  force_source_diff_unsupported_type:
    'Diff for this metadata type is currently not supported',
  force_source_diff_title: '%s//%s ↔ local//%s',
  force_source_diff_command_not_found:
    'To run this command, first install the @salesforce/sfdx-diff plugin. For more info, see [https://forcedotcom.github.io/salesforcedx-vscode/articles/user-guide/source-diff](https://forcedotcom.github.io/salesforcedx-vscode/articles/user-guide/source-diff).',
  beta_tapi_mdcontainer_error: 'Unexpected error creating metadata container',
  beta_tapi_membertype_error: 'Unexpected error creating %s member',
  beta_tapi_car_error: 'Unexpected error creating container async request',
  beta_tapi_queue_status: 'The deploy is still in the Queue',
  lib_retrieve_result_title: 'Retrieved Source',
  lib_retrieve_result_parse_error:
    'Not able to parse current results. Raw result: %s'
};
