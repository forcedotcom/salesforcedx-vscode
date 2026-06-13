/*
 * Copyright (c) 2026, salesforce.com, inc.
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
export { SFDX_CORE_CONFIGURATION_NAME, TELEMETRY_GLOBAL_USER_ID, TELEMETRY_GLOBAL_WEB_USER_ID } from './constants';
export { type SalesforceVSCodeOrgApi } from './context/orgExtensionUtils';
export { OrgUserInfo, OrgShape, WorkspaceContextUtil } from './context/workspaceContextUtil';
export { TelemetryService } from './services/telemetry';
export { isInternalHost } from './telemetry/utils/isInternal';
export {
  createDirectory,
  fileOrFolderExists,
  readDirectory,
  readFile,
  safeDelete,
  stat,
  writeFile
} from './helpers/fs';
export { fileExtensionsMatch, projectPaths } from './helpers/paths';
export { errorToString } from './helpers/errorUtils';
export { updateUserIDOnTelemetryReporters as refreshAllExtensionReporters } from './helpers/telemetryUtils';
export type { SharedAuthState } from './helpers/authUtils';
export { getTargetOrgOrAlias, getTargetDevHubOrAlias, getOrgApiVersion } from './util/authInfo';
export { hasRootWorkspace, workspaceUtils } from './workspaces/workspaceUtils';
export { CliCommandExecutor } from './cli/commandExecutor';

export type { ContinueResponse, CancelResponse, ParametersGatherer } from './commands/parameterGatherers';
export type { PreconditionChecker } from './commands/preconditionCheckers';
export type { PostconditionChecker } from './commands/postconditionCheckers';
export { ConfigAggregatorProvider } from './providers/configAggregatorProvider';
export { SettingsService } from './settings/settingsService';
export { code2ProtocolConverter } from './languageClients/conversion';
