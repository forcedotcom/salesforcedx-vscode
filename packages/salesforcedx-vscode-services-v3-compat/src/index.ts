/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export { AliasService, ConfigService, ConnectionService } from './services.js';
export { createLegacyServices } from './createLegacyServices.js';
export { DefaultOrgInfoSchema, type DefaultOrgInfo } from './defaultOrgInfo.js';
export {
  ConfigFailureSchema,
  ConnectionFailureSchema,
  type ConfigFailure,
  type ConnectionFailure
} from './serviceErrors.js';
export type { CompatibilityHost, HostExit, HostReason } from './compatibilityHost.js';
