/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// import { Aliases } from '@salesforce/core';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { FileInfo, OrgList } from '../orgPicker';

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
  /*
  try {
    const daysBeforeExpire = 5;
    const today = new Date();
    const daysUntilExpiration = new Date();
    daysUntilExpiration.setDate(
      daysUntilExpiration.getDate() + daysBeforeExpire
    );

    const authInfoObjects = await orgList.getAuthInfoObjects();
    if (!authInfoObjects) {
      return;
    }

    const orgsAboutToExpire = authInfoObjects!.filter((authInfoObject: FileInfo) => {
      // Filter out the dev hubs.
      if (authInfoObject.isDevHub) {
        return false;
      }

      // Some dev hubs have isDevHub=false, but no expiration date, so filter them out.
      if (!authInfoObject.expirationDate) {
        return false;
      }

      // Filter out the expired orgs.
      const expirationDate = new Date(authInfoObject.expirationDate);
      if (expirationDate < today) {
        return false;
      }

      // Now filter and only return the results that are within the 5 day window.
      return expirationDate <= daysUntilExpiration;
    });

    if (!orgsAboutToExpire || orgsAboutToExpire.length < 1) {
      return;
    }

    const defaultOptions = Aliases.getDefaultOptions();
    const aliases = await Aliases.create(defaultOptions);

    const formattedOrgsToDisplay = orgsAboutToExpire.map((orgAboutToExpire: any) => {
      const alias = aliases.getKeysByValue(orgAboutToExpire.username);
      const aliasName = alias.length > 0
        ? alias.toString()
        : orgAboutToExpire.username;

      return nls.localize(
        'pending_org_expiration_expires_on_message',
        aliasName,
        orgAboutToExpire.expirationDate
      );
    }).join('\n\n');

    notificationService.showWarningMessage(
      nls.localize(
        'pending_org_expiration_notification_message',
        daysBeforeExpire
      )
    );
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
  */
}
