/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export { ChannelService } from './commands/channelService';
export { notificationService } from './commands/notificationService';

export { NotificationService } from './commands/notificationService';
export { ProgressNotification } from './commands/progressNotification';
export { CompositeParametersGatherer, EmptyParametersGatherer } from './commands/parameterGatherers';
export { EmptyPostChecker } from './commands/postconditionCheckers';
export { SfWorkspaceChecker, isSalesforceProjectOpened } from './commands/preconditionCheckers';
export { SfCommandletExecutor, LibraryCommandletExecutor } from './commands/commandletExecutors';
export { SfCommandlet } from './commands/sfCommandlet';
export { ConfigSource, ConfigUtil } from './config/configUtil';
export {
  APEX_CODE_DEBUG_LEVEL,
  SETTING_CLEAR_OUTPUT_TAB,
  SFDX_CORE_CONFIGURATION_NAME,
  SFDX_CORE_EXTENSION_NAME,
  SFDX_LWC_EXTENSION_NAME,
  TELEMETRY_GLOBAL_USER_ID,
  TELEMETRY_GLOBAL_WEB_USER_ID,
  TRACE_FLAG_EXPIRATION_KEY,
  VISUALFORCE_DEBUG_LEVEL
} from './constants';
export { OrgUserInfo, OrgShape, WorkspaceContextUtil } from './context/workspaceContextUtil';
export { TelemetryService } from './services/telemetry';
export { isInternalHost } from './telemetry/utils/isInternal';
export { TimingUtils } from './helpers/timingUtils';
export { ActivationTracker } from './helpers/activationTracker';
export { isSFContainerMode } from './helpers/env';
export { extensionUris } from './helpers/extensionUris';
export {
  createDirectory,
  deleteFile,
  ensureCurrentWorkingDirIsProjectPath,
  fileOrFolderExists,
  isEmptyDirectory,
  isDirectory,
  isFile,
  readDirectory,
  readFile,
  rename,
  safeDelete,
  stat,
  writeFile
} from './helpers/fs';
export {
  fileExtensionsMatch,
  getRelativeProjectPath,
  getTestResultsFolder,
  projectPaths,
  TOOLS
} from './helpers/paths';
export {
  TraceFlags,
  showTraceFlagExpiration,
  disposeTraceFlagExpiration,
  getTraceFlagExpirationKey,
  handleTraceFlagCleanup
} from './helpers/traceFlags';
export {
  difference,
  extractJson,
  fileUtils,
  fixupError,
  getJsonCandidate,
  getMessageFromError,
  identifyJsonTypeInString,
  isNullOrUndefined
} from './helpers/utils';
export {
  isAlphaNumSpaceString,
  isAlphaNumString,
  isInteger,
  isIntegerInRange,
  isRecordIdFormat
} from './helpers/validations';
export { errorToString } from './helpers/errorUtils';
export { updateUserIDOnTelemetryReporters as refreshAllExtensionReporters } from './helpers/telemetryUtils';
export { AppInsights } from './telemetry/reporters/appInsights';
export { hasRootWorkspace, getRootWorkspace, getRootWorkspacePath, workspaceUtils } from './workspaces/workspaceUtils';
export { CliCommandExecution, CliCommandExecutor } from './cli/commandExecutor';
export { LocalCommandExecution } from './cli/localCommandExecutor';
export { OrgCreateErrorResult, OrgCreateResultParser, OrgCreateSuccessResult } from './cli/orgCreateResultParser';
export {
  OrgOpenContainerResultParser,
  OrgOpenErrorResult,
  OrgOpenSuccessResult
} from './cli/orgOpenContainerResultParser';
export { LocalizationService, LOCALE_JA, MISSING_LABEL_MSG } from '@salesforce/salesforcedx-utils';
export {
  SFDX_PROJECT_FILE,
  ENV_SF_TARGET_ORG,
  ENV_SF_ORG_INSTANCE_URL,
  SF_CONFIG_ISV_DEBUGGER_SID,
  SF_CONFIG_ISV_DEBUGGER_URL,
  TARGET_ORG_KEY,
  DEFAULT_CONNECTION_TIMEOUT_MS,
  CLIENT_ID,
  SFDX_FOLDER
} from './constants';

export type { DirFileNameSelection, LocalComponent } from './types';
export type { ContinueResponse, CancelResponse, ParametersGatherer } from './commands/parameterGatherers';
export type { PreconditionChecker } from './commands/preconditionCheckers';
export type { PostconditionChecker } from './commands/postconditionCheckers';
export type { CommandletExecutor } from './commands/commandletExecutors';
export { MessageArgs } from '@salesforce/salesforcedx-utils';
export {
  TelemetryReporter,
  Measurements,
  Properties,
  TelemetryData,
  ExtensionInfo,
  ExtensionsInfo,
  ActivationInfo,
  TelemetryServiceInterface
} from '@salesforce/vscode-service-provider';
export {
  getYYYYMMddHHmmssDateFormat,
  makeDoubleDigit,
  optionHHmm,
  optionMMddYYYY,
  optionYYYYMMddHHmmss
} from './date/format';
export { Column, Row, Table } from './output/table';
export { ConfigAggregatorProvider } from './providers/configAggregatorProvider';
export { SourceTrackingProvider } from './providers/sourceTrackingProvider';
export { SourceTrackingType, SourceTrackingService } from './services/sourceTrackingService';
export { UserService, getWebTelemetryUserId, DefaultSharedTelemetryProvider } from './services/userService';
export { AdvancedSettings, SettingsService } from './settings/settingsService';
export { code2ProtocolConverter } from './languageClients/conversion';
export { nls } from './messages/messages';
