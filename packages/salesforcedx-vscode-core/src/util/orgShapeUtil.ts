/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection, Org } from '@salesforce/core';

export const isAScratchOrg = async (username: string): Promise<boolean> => {
  const authInfo = await AuthInfo.create({ username });
  const org: Org = await Org.create({
    connection: await Connection.create({ authInfo })
  });
  if (org.isScratch()) {
    return true;
  }
  const authInfoFields = authInfo.getFields();
  return !!authInfoFields.devHubUsername || false;
};

export const isASandboxOrg = async (username: string): Promise<boolean> => {
  const authInfo = await AuthInfo.create({ username });
  const org: Org = await Org.create({
    connection: await Connection.create({ authInfo })
  });
  if (await org.isSandbox()) {
    return true;
  }
  const result = await org
    .getConnection()
    .singleRecordQuery<{ IsSandbox: boolean }>('select IsSandbox from organization');
  return result?.IsSandbox;
};

export const getDevHubIdFromScratchOrg = async (username: string): Promise<string | undefined> => {
  if (await isAScratchOrg(username)) {
    const scratchOrg: Org = await Org.create({
      connection: await Connection.create({
        authInfo: await AuthInfo.create({ username })
      })
    });
    const devHubOrg = await scratchOrg.getDevHubOrg();
    return devHubOrg?.getOrgId();
  }
  return undefined;
};
