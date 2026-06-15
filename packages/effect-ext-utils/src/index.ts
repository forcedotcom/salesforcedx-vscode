/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export {
  ExtensionProviderService,
  InvalidServicesApiError,
  ServicesExtensionNotFoundError,
  getServicesApi
} from './extensionProvider';

export { buildAllServicesLayer } from './allServicesLayer';
export { ExtensionPackageJsonSchema, type ExtensionPackageJson } from './extensionPackageJson';
export { closeExtensionScope, getExtensionScope } from './extensionScope';
export type { SalesforceVSCodeServicesApi } from './extensionProvider';

export { createTable } from './table';
export type { Column, Row } from './table';

export { sfProjectPreconditionChecker } from './preconditionCheckers';

export { extractJson, getJsonCandidate, identifyJsonTypeInString, stripAnsi, getMessageFromError } from './utils';

export { annotateRootSpan } from './annotateRootSpan';
