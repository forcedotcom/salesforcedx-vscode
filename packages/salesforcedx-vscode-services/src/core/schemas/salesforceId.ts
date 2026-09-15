/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

/** 15-char case-sensitive or 18-char case-insensitive Salesforce record id. */
export const SalesforceId = Schema.String.pipe(
  Schema.pattern(/^(?:[A-Za-z0-9]{15}|[A-Za-z0-9]{18})$/),
  Schema.brand('@services/SalesforceId')
);
export type SalesforceId = typeof SalesforceId.Type;

/** Organization id (`00D…`). */
export const OrgId = SalesforceId.pipe(Schema.startsWith('00D'), Schema.brand('@services/OrgId'));
export type OrgId = typeof OrgId.Type;
