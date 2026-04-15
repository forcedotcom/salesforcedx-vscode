/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export { aliasListCommand } from './aliasList';
export { configList } from './configList';
export { deleteSource } from './deleteSource';
export { projectGenerateManifest } from './projectGenerateManifest';
export { packageInstall } from './packageInstall';
export { initSObjectDefinitions } from './refreshSObjects';
export { renameLightningComponent } from './renameLightningComponent';
export { deployManifest } from './deployManifest';
export { deploySourcePaths } from './deploySourcePath';
export { sourceDiff, sourceFolderDiff } from './sourceDiff';
export { retrieveManifest } from './retrieveManifest';
export { retrieveSourcePaths } from './retrieveSourcePath';
export { openDocumentation } from './openDocumentation';
export { projectDeployStart } from './projectDeployStart';
export {
  agentProjectGenerate,
  nativemobileProjectGenerate,
  projectGenerateWithManifest,
  sfProjectGenerate
} from './projectGenerate';
export { projectRetrieveStart } from './projectRetrieveStart';
export { viewAllChanges, viewLocalChanges, viewRemoteChanges } from './source/viewChanges';
export {
  analyticsGenerateTemplate,
  internalLightningGenerateApp,
  internalLightningGenerateAuraComponent,
  internalLightningGenerateEvent,
  internalLightningGenerateInterface,
  internalLightningGenerateLwc,
  lightningGenerateApp,
  lightningGenerateAuraComponent,
  lightningGenerateEvent,
  lightningGenerateInterface,
  visualforceGenerateComponent,
  visualforceGeneratePage
} from './templates';
