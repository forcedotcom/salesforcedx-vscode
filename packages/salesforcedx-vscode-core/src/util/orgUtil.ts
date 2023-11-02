/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthFields, AuthInfo } from '@salesforce/core';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { OrgList } from '../orgPicker';
import { OrgAuthInfo, workspaceUtils } from '../util';

export async function setUpOrgExpirationWatcher(orgList: OrgList) {
  // Run once to start off with.
  await checkForExpiredOrgs(orgList);

  /*
  Comment this out for now.  For now, we are only going to check once on activation,
  however it would be helpful if we also checked once a day.  If we decide to also
  check once a day, uncomment the following code.

  // And run again once every 24 hours.
  setInterval(async () => {
    await checkForExpiredOrgs(orgList);
  }, 1000 * 60 * 60 * 24);
  */
}

export async function checkForExpiredOrgs(orgList: OrgList) {
  if (!orgList) {
    return;
  }

  try {
    const daysBeforeExpire = 5;
    const today = new Date();
    const daysUntilExpiration = new Date();
    daysUntilExpiration.setDate(
      daysUntilExpiration.getDate() + daysBeforeExpire
    );

    const orgAuthorizations = await AuthInfo.listAllAuthorizations();
    if (!orgAuthorizations) {
      return;
    }

    const results: string[] = [];
    for (const orgAuthorization of orgAuthorizations) {
      // Filter out the dev hubs.
      if (orgAuthorization.isDevHub) {
        continue;
      }

      const authFields = await getAuthFieldsFor(orgAuthorization.username);

      // Some dev hubs have isDevHub=false but no expiration date, so filter them out.
      if (!authFields.expirationDate) {
        continue;
      }

      // Filter out the expired orgs.
      const expirationDate = new Date(authFields.expirationDate);
      if (expirationDate < today) {
        continue;
      }

      // Now filter and only return the results that are within the 5 day window.
      if (expirationDate <= daysUntilExpiration) {
        const aliasName =
          orgAuthorization.aliases && orgAuthorization.aliases.length > 0
            ? orgAuthorization.aliases[0]
            : orgAuthorization.username;

        results.push(
          nls.localize(
            'pending_org_expiration_expires_on_message',
            aliasName,
            authFields.expirationDate
          )
        );
      }
    }

    if (results.length < 1) {
      return;
    }

    notificationService.showWarningMessage(
      nls.localize(
        'pending_org_expiration_notification_message',
        daysBeforeExpire
      )
    );

    const formattedOrgsToDisplay = results.join('\n\n');
    channelService.appendLine(
      nls.localize(
        'pending_org_expiration_output_channel_message',
        daysBeforeExpire,
        formattedOrgsToDisplay
      )
    );
    channelService.showChannelOutput();
  } catch (err) {
    console.error(err);
  }
}

export async function getAuthFieldsFor(username: string): Promise<AuthFields> {
  const authInfo: AuthInfo = await AuthInfo.create({
    username
  });

  return authInfo.getFields();
}

export async function getDefaultDevHubUsernameOrAlias(): Promise<
  string | undefined
> {
  if (workspaceUtils.hasRootWorkspace()) {
    return OrgAuthInfo.getDefaultDevHubUsernameOrAlias(false);
  }
}
