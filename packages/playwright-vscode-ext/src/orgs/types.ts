/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { AuthFields, Org } from '@salesforce/core';

export type OrgAuthResult = Required<Pick<AuthFields, 'instanceUrl' | 'accessToken' | 'instanceApiVersion'>> & {
  sessionContext: Pick<
    AuthFields,
    | 'username'
    | 'orgId'
    | 'userId'
    | Org.Fields.INSTANCE_NAME
    | Org.Fields.ORG_EDITION
    | Org.Fields.NAMESPACE_PREFIX
    | 'isDevHub'
    | Org.Fields.IS_SCRATCH
    | Org.Fields.IS_SANDBOX
  >;
};

type OrgDisplayFields = { instanceUrl: string; apiVersion: string; username: string; status?: string };
export type OrgDisplayResult = { result: OrgDisplayFields };

export type OrgDisplayUserResult = { result: { id: string; orgId: string } };
