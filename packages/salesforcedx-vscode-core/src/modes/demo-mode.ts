/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export function isDemoMode() {
  return process.env.SFDX_ENV ? process.env.SFDX_ENV === 'DEMO' : false;
}

export type authResponse = {
  orgId: string;
  username: string;
  accessToken?: string;
  instanceUrl?: string;
  refreshToken?: string;
  loginUrl?: string;
  clientId?: string;
  trialExpirationDate?: string | null;
  clientSecret?: string;
};

export function isProdOrg(response: { status: number; result: authResponse }) {
  return response.result.trialExpirationDate ? false : true;
}
