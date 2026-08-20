/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export {
  SoqlBuilderActionEvent,
  SoqlBuilderApp,
  defaultSoqlBuilderLabels,
  type SoqlBuilderLabels,
  type SoqlBuilderLifecycle
} from './components/soqlBuilderApp.js';
export {
  InvalidSoqlBuilderMetadataError,
  SOQL_BUILDER_ACTION_EVENT,
  SoqlBuilderActionSchema,
  SoqlBuilderDriverError,
  SoqlBuilderMetadataSchema,
  SoqlBuilderQuerySchema,
  SoqlBuilderStateSchema,
  SoqlFieldMetadataSchema,
  SoqlObjectMetadataSchema,
  createInitialSoqlBuilderState,
  decodeSoqlBuilderMetadata,
  type SoqlBuilderAction,
  type SoqlBuilderMetadata,
  type SoqlBuilderQuery,
  type SoqlBuilderState,
  type SoqlFieldMetadata,
  type SoqlObjectMetadata
} from './domain.js';
export { SoqlBuilderApplication, type SoqlBuilderView } from './application.js';
export { SoqlBuilderController, SoqlBuilderControllerLive } from './effect/soqlBuilderController.js';
export { SoqlBuilderDriver } from './effect/soqlBuilderDriver.js';
export type { SoqlBuilderController as SoqlBuilderControllerService } from './effect/soqlBuilderController.js';
export type { SoqlBuilderDriver as SoqlBuilderDriverService } from './effect/soqlBuilderDriver.js';
export { registerSoqlBuilderElements } from './register.js';
