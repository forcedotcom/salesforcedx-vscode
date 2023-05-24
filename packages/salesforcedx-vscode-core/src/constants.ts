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
export const SFDX_CONFIG_DISABLE_TELEMETRY = 'disableTelemetry';
export const ENV_SFDX_DISABLE_TELEMETRY = 'SFDX_DISABLE_TELEMETRY';
export const SFDX_CLI_DOWNLOAD_LINK =
  'https://developer.salesforce.com/tools/sfdxcli';
export const DEFAULT_USERNAME_KEY = 'defaultusername';
export const DEFAULT_DEV_HUB_USERNAME_KEY = 'defaultdevhubusername';
export const PKG_ID_PREFIX = '04t';

export const TELEMETRY_GLOBAL_VALUE = 'sfdxTelemetryMessage';
export const TELEMETRY_OPT_OUT_LINK =
  'https://developer.salesforce.com/tools/vscode/en/faq/telemetry';
export const TELEMETRY_METADATA_COUNT = 'metadataCount';

export const CONFIG_SET_EXECUTOR = 'force_config_set_org_text';
export const CONFIG_SET_NAME = 'force_config_set_title';
export const TABLE_NAME_COL = 'table_header_name';
export const TABLE_VAL_COL = 'table_header_value';
export const TABLE_SUCCESS_COL = 'table_header_success';

// sfdxCore setting config values
export const BETA_DEPLOY_RETRIEVE = 'experimental.deployRetrieve';
export const CONFLICT_DETECTION_ENABLED = 'detectConflictsAtSync';
export const INTERNAL_DEVELOPMENT_FLAG = 'internal-development';
export const PUSH_OR_DEPLOY_ON_SAVE_ENABLED = 'push-or-deploy-on-save.enabled';
export const PREFER_DEPLOY_ON_SAVE_ENABLED =
  'push-or-deploy-on-save.preferDeployOnSave';
export const PUSH_OR_DEPLOY_ON_SAVE_OVERRIDE_CONFLICTS =
  'push-or-deploy-on-save.overrideConflictsOnPush';
export const RETRIEVE_TEST_CODE_COVERAGE = 'retrieve-test-code-coverage';
export const SHOW_CLI_SUCCESS_INFO_MSG = 'show-cli-success-msg';
export const TELEMETRY_ENABLED = 'telemetry.enabled';
export const ENABLE_SOBJECT_REFRESH_ON_STARTUP =
  'enable-sobject-refresh-on-startup';
export const ENABLE_DEPLOY_AND_RETRIEVE_FOR_SOURCE_TRACKED_ORGS =
  'enableDeployAndRetrieveForSourceTrackedOrgs.enabled';
export const CLI = {
  AUTH_DEVICE_LOGIN: 'force:auth:device:login',
  AUTH_WEB_LOGIN: 'force:auth:web:login'
};
export const APEX_FILE_NAME_EXTENSION = '.apex';
export const SOQL_FILE_NAME_EXTENSION = '.soql';
export const AURA_PATH = '/force-app/main/default/aura/';
export const APEX_CLASSES_PATH = '/force-app/main/default/classes/';
export const LWC_PATH = '/force-app/main/default/lwc/';
export const FUNCTIONS_PATH = '/functions/';

// Commands
export const ORG_OPEN_COMMAND = 'sfdx.force.org.open';
export const FORCE_SOURCE_PULL_LOG_NAME =
  'force_source_pull_default_scratch_org';
export const FORCE_SOURCE_PUSH_LOG_NAME =
  'force_source_push_default_scratch_org';
