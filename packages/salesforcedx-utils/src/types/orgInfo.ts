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
  status: string;
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

export type OrgQueryResult = {
  Id: string;
  Name: string;
  CreatedDate: string;
  CreatedBy: { Username: string };
  OrganizationType: string;
  InstanceName: string;
  IsSandbox: boolean;
  NamespacePrefix: string;
};

export type ScratchOrgQueryResult = {
  Status: string;
  CreatedBy: { Username: string };
  CreatedDate: string;
  ExpirationDate: string;
  Edition: string;
  OrgName: string;
};

export type ScratchOrgInfo = {
  status: string;
  createdBy: string;
  createdDate: string;
  expirationDate: string;
  edition: string;
  orgName: string;
  password?: string;
};
