/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export { aliasListCommand } from './aliasList';
export { configList } from './configList';
export { packageInstall } from './packageInstall';
export { initSObjectDefinitions } from './refreshSObjects';
export { renameLightningComponent } from './renameLightningComponent';
export { openDocumentation } from './openDocumentation';
export {
  agentProjectGenerate,
  nativemobileProjectGenerate,
  projectGenerateWithManifest,
  sfProjectGenerate
} from './projectGenerate';
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
