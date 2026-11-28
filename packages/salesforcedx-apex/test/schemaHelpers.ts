/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { ApexClassId, ApexLogId, SalesforceId } from '../src/effect/schema/salesforceId';

export const salesforceId = Schema.decodeUnknownSync(SalesforceId);
export const apexClassId = Schema.decodeUnknownSync(ApexClassId);
export const apexLogId = Schema.decodeUnknownSync(ApexLogId);
