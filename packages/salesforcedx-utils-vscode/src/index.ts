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
export { type SalesforceVSCodeOrgApi } from './context/orgExtensionUtils';
export { OrgUserInfo, OrgShape, WorkspaceContextUtil } from './context/workspaceContextUtil';
export { TelemetryService } from './services/telemetry';
export { isInternalHost } from './telemetry/utils/isInternal';
export { ActivationTracker } from './helpers/activationTracker';
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
export { fileExtensionsMatch, getTestResultsFolder, projectPaths, TOOLS } from './helpers/paths';
export { extractJson, getJsonCandidate, getMessageFromError, identifyJsonTypeInString } from './helpers/utils';
export { isAlphaNumSpaceString, isIntegerInRange, isRecordIdFormat } from './helpers/validations';
export { errorToString } from './helpers/errorUtils';
export { updateUserIDOnTelemetryReporters as refreshAllExtensionReporters } from './helpers/telemetryUtils';
export type { SharedAuthState } from './helpers/authUtils';
export {
  getDevHubIdFromScratchOrg,
  getTargetOrgOrAlias,
  isASandboxOrg,
  isAScratchOrg,
  getDevHubUsername,
  getTargetDevHubOrAlias,
  getUsername,
  getOrgApiVersion,
  getConnection,
  getAuthFields
} from './util/authInfo';
export { hasRootWorkspace, getRootWorkspacePath, workspaceUtils } from './workspaces/workspaceUtils';
export { CliCommandExecutor } from './cli/commandExecutor';
export { SFDX_FOLDER } from './constants';

export type { ContinueResponse, CancelResponse, ParametersGatherer } from './commands/parameterGatherers';
export type { PreconditionChecker } from './commands/preconditionCheckers';
export type { PostconditionChecker } from './commands/postconditionCheckers';
export { ConfigAggregatorProvider } from './providers/configAggregatorProvider';
export { UserService } from './services/userService';
export { SettingsService } from './settings/settingsService';
export { code2ProtocolConverter } from './languageClients/conversion';
