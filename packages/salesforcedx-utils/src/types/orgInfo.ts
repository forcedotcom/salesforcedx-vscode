/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export type OrgInfo = {
  username: string;
  devHubId: string;
  id: string;
  createdBy: string;
  createdDate: string;
  expirationDate: string;
  status: string; // only present for scratch orgs
  edition: string;
  orgName: string;
  accessToken: string;
  instanceUrl: string;
  clientId: string;
  apiVersion: string;
  alias: string;
  connectionStatus: string;
  password?: string;
  namespace?: string;
};
