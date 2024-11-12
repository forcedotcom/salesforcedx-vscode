/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export const SFDX_PROJECT_FILE = 'sfdx-project.json';
export const SFDX_CONFIG_FILE = 'sfdx-config.json';
export const SFDX_FOLDER = '.sfdx';
export const CLIENT_ID = 'sfdx-vscode';
export const STATUS_BAR_MSG_TIMEOUT_MS = 5000;
export const APEX_CODE_DEBUG_LEVEL = 'FINEST';
export const VISUALFORCE_DEBUG_LEVEL = 'FINER';
export const ENV_SF_DISABLE_TELEMETRY = 'SF_DISABLE_TELEMETRY';
export const SF_CLI_DOWNLOAD_LINK = 'https://developer.salesforce.com/tools/salesforcecli';
export const TARGET_ORG_KEY = 'target-org';
export const PKG_ID_PREFIX = '04t';

export const TELEMETRY_GLOBAL_VALUE = 'sfdxTelemetryMessage';
export const TELEMETRY_OPT_OUT_LINK = 'https://developer.salesforce.com/tools/vscode/en/faq/telemetry';
export const TELEMETRY_INTERNAL_VALUE = 'sfdxTelemetryMessageInternal';
export const TELEMETRY_METADATA_COUNT = 'metadataCount';
export const BASE_EXTENSION = 'salesforce.salesforcedx-vscode';
export const EXPANDED_EXTENSION = 'salesforce.salesforcedx-vscode-expanded';
export const EXT_PACK_STATUS_EVENT_NAME = 'extensionPackStatus';

export const CONFIG_SET_EXECUTOR = 'config_set_org_text';
export const CONFIG_SET_NAME = 'config_set_title';
export const TABLE_NAME_COL = 'table_header_name';
export const TABLE_VAL_COL = 'table_header_value';
export const TABLE_SUCCESS_COL = 'table_header_success';

// sfdxCore setting config values
export const CONFLICT_DETECTION_ENABLED = 'detectConflictsAtSync';
export const INTERNAL_DEVELOPMENT_FLAG = 'internal-development';
export const PUSH_OR_DEPLOY_ON_SAVE_ENABLED = 'push-or-deploy-on-save.enabled';
export const PREFER_DEPLOY_ON_SAVE_ENABLED = 'push-or-deploy-on-save.preferDeployOnSave';
export const PUSH_OR_DEPLOY_ON_SAVE_IGNORE_CONFLICTS = 'push-or-deploy-on-save.ignoreConflictsOnPush';
export const DEPLOY_ON_SAVE_SHOW_OUTPUT_PANEL = 'push-or-deploy-on-save.showOutputPanel';
export const RETRIEVE_TEST_CODE_COVERAGE = 'retrieve-test-code-coverage';
export const SHOW_CLI_SUCCESS_INFO_MSG = 'show-cli-success-msg';
export const TELEMETRY_ENABLED = 'telemetry.enabled';
export const ENABLE_SOBJECT_REFRESH_ON_STARTUP = 'enable-sobject-refresh-on-startup';
export const ENABLE_DEPLOY_AND_RETRIEVE_FOR_SOURCE_TRACKED_ORGS = 'enableDeployAndRetrieveForSourceTrackedOrgs.enabled';
export const ENABLE_SOURCE_TRACKING_FOR_DEPLOY_RETRIEVE = 'experimental.enableSourceTrackingForDeployAndRetrieve';
export const ENV_NODE_EXTRA_CA_CERTS = 'NODE_EXTRA_CA_CERTS';
export const ENV_SF_LOG_LEVEL = 'SF_LOG_LEVEL';
export const CLI = {
  ORG_LOGIN_DEVICE: 'org:login:device',
  ORG_LOGIN_WEB: 'org:login:web'
};
export const APEX_FILE_NAME_EXTENSION = '.apex';
export const SOQL_FILE_NAME_EXTENSION = '.soql';
export const AURA_PATH = '/force-app/main/default/aura/';
export const APEX_CLASSES_PATH = '/force-app/main/default/classes/';
export const LWC_PATH = '/force-app/main/default/lwc/';
export const FUNCTIONS_PATH = '/functions/';

// Commands
export const ORG_OPEN_COMMAND = 'sf.org.open';
export const PROJECT_RETRIEVE_START_LOG_NAME = 'project_retrieve_start_default_scratch_org';
export const PROJECT_DEPLOY_START_LOG_NAME = 'project_deploy_start_default_scratch_org';
