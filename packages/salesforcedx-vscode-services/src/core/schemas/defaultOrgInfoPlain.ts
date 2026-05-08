/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export type DefaultOrgInfo = {
  aliases?: string[];
  orgId?: string;
  devHubOrgId?: string;
  username?: string;
  alias?: string;
  devHubUsername?: string;
  tracksSource?: boolean;
  isScratch?: boolean;
  isSandbox?: boolean;
  userId?: string;
  cliId?: string;
  webUserId?: string;
};
