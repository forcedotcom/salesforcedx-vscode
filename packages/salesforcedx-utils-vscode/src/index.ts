/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export { ChannelService } from './commands/channelService';
export { SFDX_CORE_CONFIGURATION_NAME } from './constants';
export { type SalesforceVSCodeOrgApi } from './context/orgExtensionUtils';
export { type OrgUserInfo } from './context/orgUserInfo';
export { shapeFrom, type OrgShape } from './context/workspaceOrgShape';
export { TelemetryService } from './services/telemetry';
export { isInternalHost } from './telemetry/utils/isInternal';
export { fileOrFolderExists, readFile } from './helpers/fs';
export { errorToString } from './helpers/errorUtils';
export { updateUserIDOnTelemetryReporters as refreshAllExtensionReporters } from './helpers/telemetryUtils';
