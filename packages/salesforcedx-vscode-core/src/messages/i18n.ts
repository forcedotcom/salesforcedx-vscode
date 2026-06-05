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
  channel_name: 'Salesforce CLI',
  config_list_text: 'SFDX: List All Config Variables',
  config_list_column_name: 'Name',
  config_list_column_value: 'Value',
  config_list_column_location: 'Location',
  config_list_table_title: 'List Config',
  config_list_no_results: 'No results found',
  alias_list_text: 'SFDX: List All Aliases',
  telemetry_legal_dialog_message:
    'You agree that Salesforce Extensions for VS Code may collect usage information, user environment, and crash reports for product improvements. Learn how to [opt out](%s).',
  telemetry_legal_dialog_button_text: 'Read more',
  telemetry_internal_user_message:
    "We're collecting information on the usage of our extensions and sending it to AppInsights to help us understand how our internal developers use them. We want to gather data on developer adoption to improve our products and services. Thanks for being a part of this process!",
  error_parsing_sfdx_project_file: "Couldn't parse sfdx-project.json file (%s). Parse error: %s",

  aura_doc_url: 'https://developer.salesforce.com/tools/vscode/en/aura/writing',
  apex_doc_url: 'https://developer.salesforce.com/tools/vscode/en/apex/writing',
  soql_doc_url: 'https://developer.salesforce.com/tools/vscode/en/soql/soql-builder',
  lwc_doc_url: 'https://developer.salesforce.com/tools/vscode/en/lwc/writing',
  functions_doc_url: 'https://developer.salesforce.com/tools/vscode/en/functions/overview',
  default_doc_url: 'https://developer.salesforce.com/tools/vscode',

  // Metadata XML Support Messages
  metadata_xml_no_redhat_extension_found:
    'Red Hat XML extension is not installed. Install it to enable metadata XML IntelliSense.',
  metadata_xml_redhat_extension_setup_success: 'Salesforce metadata XML IntelliSense is now available.',
  metadata_xml_redhat_extension_regression:
    'Salesforce metadata XML IntelliSense does not work with Red Hat XML extension version 0.15.0. Upgrade the Red Hat XML extension.',
  metadata_xml_deprecated_redhat_extension:
    'Salesforce metadata XML IntelliSense requires the Red Hat XML extension version >= 0.14.0. Upgrade the Red Hat XML extension.',
  metadata_xml_vmargs_configured:
    'Configured xml.server.vmargs to -Xmx1024M in User settings to prevent Out Of Memory errors.',
  metadata_xml_fail_redhat_extension: 'Failed to setup Red Hat XML extension for metadata XML support'
} as const;

export type MessageKey = keyof typeof messages;
