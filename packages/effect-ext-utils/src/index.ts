/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export { ExtensionContextNotAvailableError, getExtensionContext, setExtensionContext } from './extensionContext';
export {
  ExtensionProviderService,
  InvalidServicesApiError,
  ServicesExtensionNotFoundError,
  getServicesApi
} from './extensionProvider';

export { closeExtensionScope, getExtensionScope } from './extensionScope';
export type { SalesforceVSCodeServicesApi } from '@salesforce/vscode-services';
