/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export { ApexConnectionProvider, apexConnectionLayer, makeApexConnectionProvider } from './capabilities/connection';
export { ApexConnectionError, ApexOperationError, ApexResponseDecodeError, causeMessage } from './errors';
