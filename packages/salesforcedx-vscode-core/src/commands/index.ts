/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export { aliasList } from './aliasList';
export { orgLoginAccessToken } from './auth/orgLoginAccessToken';
export { orgLoginWeb } from './auth/orgLoginWeb';
export { orgLoginWebDevHub } from './auth/orgLoginWebDevHub';
export { orgLogoutAll, orgLogoutDefault } from './auth/orgLogout';
export { configList } from './configList';
export { configSet } from './configSet';
export { dataQuery } from './dataQuery';
export { debuggerStop } from './debuggerStop';
export { deleteSource } from './deleteSource';
export { projectGenerateManifest } from './projectGenerateManifest';
export { describeMetadata } from './describeMetadata';
export { packageInstall } from './packageInstall';
export { refreshSObjects, initSObjectDefinitions } from './refreshSObjects';
export { renameLightningComponent } from './renameLightningComponent';
export { deployManifest } from './deployManifest';
export { deploySourcePaths } from './deploySourcePath';
export { sourceDiff, sourceFolderDiff } from './sourceDiff';
export { retrieveManifest } from './retrieveManifest';
export { retrieveComponent } from './retrieveMetadata';
export { retrieveSourcePaths } from './retrieveSourcePath';
export { openDocumentation } from './openDocumentation';
export { orgCreate } from './orgCreate';
export { orgDelete } from './orgDelete';
export { orgDisplay } from './orgDisplay';
export { orgList } from './orgList';
export { orgOpen } from './orgOpen';
export { projectDeployStart } from './projectDeployStart';
export { projectGenerateWithManifest, sfProjectGenerate } from './projectGenerate';
export { projectRetrieveStart } from './projectRetrieveStart';
export { viewAllChanges, viewLocalChanges, viewRemoteChanges } from './source/viewChanges';
export { startApexDebugLogging } from './startApexDebugLogging';
export { turnOffLogging } from './stopApexDebugLogging';
export { taskStop } from './taskStop';
export {
  analyticsGenerateTemplate,
  apexGenerateClass,
  apexGenerateTrigger,
  apexGenerateUnitTestClass,
  internalLightningGenerateApp,
  internalLightningGenerateAuraComponent,
  internalLightningGenerateEvent,
  internalLightningGenerateInterface,
  internalLightningGenerateLwc,
  lightningGenerateApp,
  lightningGenerateAuraComponent,
  lightningGenerateEvent,
  lightningGenerateInterface,
  lightningGenerateLwc,
  visualforceGenerateComponent,
  visualforceGeneratePage
} from './templates';
import { DeveloperLogTraceFlag } from '../traceflag/developerLogTraceFlag';

export const developerLogTraceFlag = DeveloperLogTraceFlag.getInstance();
