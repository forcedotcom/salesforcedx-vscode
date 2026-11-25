/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SalesforceVSCodeServicesApi } from '@salesforce/effect-ext-utils';
import type * as Effect from 'effect/Effect';
import type * as Schema from 'effect/Schema';

type ApexLogServiceApi = SalesforceVSCodeServicesApi['services']['ApexLogService'];

export type ApexLogListItem = Effect.Effect.Success<ReturnType<ApexLogServiceApi['listLogs']>>[number];
export type ListLogsOptions = NonNullable<Parameters<ApexLogServiceApi['listLogs']>[0]>;
export type TraceFlagItem = Schema.Schema.Type<SalesforceVSCodeServicesApi['services']['TraceFlagItemStruct']>;
