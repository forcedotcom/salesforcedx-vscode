/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export { ChannelService } from './commands/channelService';
export { notificationService } from './commands/notificationService';
export { ProgressNotification } from './commands/progressNotification';
export {
  CompositeParametersGatherer,
  EmptyParametersGatherer,
  type FlagParameter
} from './commands/parameterGatherers';
export { SfWorkspaceChecker, isSalesforceProjectOpened } from './commands/preconditionCheckers';
export { SfCommandletExecutor, LibraryCommandletExecutor } from './commands/commandletExecutors';
export { SfCommandlet } from './commands/sfCommandlet';
export { ConfigUtil } from './config/configUtil';
export {
  SETTING_CLEAR_OUTPUT_TAB,
  SFDX_CORE_CONFIGURATION_NAME,
  SFDX_LWC_EXTENSION_NAME,
  TELEMETRY_GLOBAL_USER_ID,
  TELEMETRY_GLOBAL_WEB_USER_ID
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
export { isAlphaNumSpaceString, isIntegerInRange, isRecordIdFormat } from './helpers/validations';
export { errorToString } from './helpers/errorUtils';
export { updateUserIDOnTelemetryReporters as refreshAllExtensionReporters } from './helpers/telemetryUtils';
export {
  getDevHubIdFromScratchOrg,
  getTargetOrgOrAlias,
  isASandboxOrg,
  isAScratchOrg,
  getDevHubUsername,
  getTargetDevHubOrAlias,
  getUsername,
  getConnection,
  getAuthFields
} from './util/authInfo';
export { hasRootWorkspace, getRootWorkspacePath, workspaceUtils } from './workspaces/workspaceUtils';
export { CliCommandExecutor } from './cli/commandExecutor';
export { LocalCommandExecution } from './cli/localCommandExecutor';
export { LocalizationService, LOCALE_JA, MISSING_LABEL_MSG } from '@salesforce/salesforcedx-utils';
export { SFDX_FOLDER } from './constants';

export type { ContinueResponse, CancelResponse, ParametersGatherer } from './commands/parameterGatherers';
export type { PreconditionChecker } from './commands/preconditionCheckers';
export type { PostconditionChecker } from './commands/postconditionCheckers';
export { getYYYYMMddHHmmssDateFormat, optionYYYYMMddHHmmss } from './date/format';
export { Column, createTable, Row } from './output/table';
export { ConfigAggregatorProvider } from './providers/configAggregatorProvider';
export { SourceTrackingType, SourceTrackingService } from './services/sourceTrackingService';
export { UserService } from './services/userService';
export { SettingsService } from './settings/settingsService';
export { code2ProtocolConverter } from './languageClients/conversion';
export { nls } from './messages/messages';
