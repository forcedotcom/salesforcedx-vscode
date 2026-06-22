/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// Hand-authored, services-owned. NO imports from @salesforce/*, jsforce, or effect.
export type ConnectionData = {
  readonly accessToken: string;
  readonly instanceUrl: string;
  readonly apiVersion: string;
  readonly username: string;
  readonly orgId: string;
};
