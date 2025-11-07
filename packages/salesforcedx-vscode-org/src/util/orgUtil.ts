/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthFields, AuthInfo, OrgConfigProperties, Config } from '@salesforce/core';
import {
  notificationService,
  ConfigUtil,
  workspaceUtils,
  ConfigAggregatorProvider
} from '@salesforce/salesforcedx-utils-vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { OrgList } from '../orgPicker/orgList';

export const setUpOrgExpirationWatcher = async (orgList: OrgList): Promise<void> => {
  // Run once to start off with.
  await checkForSoonToBeExpiredOrgs(orgList);

  /*
  Comment this out for now.  For now, we are only going to check once on activation,
  however it would be helpful if we also checked once a day.  If we decide to also
  check once a day, uncomment the following code.

  // And run again once every 24 hours.
  setInterval(
    async () => {
      void checkForSoonToBeExpiredOrgs(orgList);
    },
    1000 * 60 * 60 * 24
  );
  */
};

export const checkForSoonToBeExpiredOrgs = async (orgList: OrgList): Promise<void> => {
  if (!orgList) {
    return;
  }

  try {
    const daysBeforeExpire = 5;
    const daysUntilExpiration = new Date();
    daysUntilExpiration.setDate(daysUntilExpiration.getDate() + daysBeforeExpire);

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
      if (expirationDate < new Date()) {
        if (orgAuthorization.username === (await ConfigUtil.getUsername())) {
          void notificationService.showWarningMessage(nls.localize('default_org_expired'));
        }
        continue;
      }

      // Now filter and only return the results that are within the 5 day window.
      if (expirationDate <= daysUntilExpiration) {
        const aliasName =
          orgAuthorization.aliases && orgAuthorization.aliases.length > 0
            ? orgAuthorization.aliases[0]
            : orgAuthorization.username;

        results.push(nls.localize('pending_org_expiration_expires_on_message', aliasName, authFields.expirationDate));
      }
    }

    if (results.length === 0) {
      return;
    }

    notificationService.showWarningMessage(
      nls.localize('pending_org_expiration_notification_message', daysBeforeExpire)
    );

    const formattedOrgsToDisplay = results.join('\n\n');
    channelService.appendLine(
      nls.localize('pending_org_expiration_output_channel_message', daysBeforeExpire, formattedOrgsToDisplay)
    );
    channelService.showChannelOutput();
  } catch (err) {
    console.error(err);
  }
};

export const getAuthFieldsFor = async (username: string): Promise<AuthFields> => {
  const authInfo: AuthInfo = await AuthInfo.create({
    username
  });

  return authInfo.getFields();
};

const updateConfigAndStateAggregators = async (): Promise<void> => {
  const { StateAggregator } = await import('@salesforce/core');

  // Force the ConfigAggregatorProvider to reload its stored
  // ConfigAggregators so that this config file change is accounted
  // for and the ConfigAggregators are updated with the latest info.
  const configAggregatorProvider = ConfigAggregatorProvider.getInstance();
  await configAggregatorProvider.reloadConfigAggregators();
  // Also force the StateAggregator to reload to have the latest
  // authorization info.
  StateAggregator.clearInstance(workspaceUtils.getRootWorkspacePath());
};

const setUsernameOrAlias = async (usernameOrAlias: string): Promise<void> => {
  const config = await Config.create(Config.getDefaultOptions());
  config.set(OrgConfigProperties.TARGET_ORG, usernameOrAlias);
  await config.write();
  await updateConfigAndStateAggregators();
};

/** Unsets the target org from the local config */
export const unsetTargetOrg = async (): Promise<void> => {
  const originalDirectory = process.cwd();
  // In order to correctly setup Config, the process directory needs to be set to the current workspace directory
  const workspacePath = workspaceUtils.getRootWorkspacePath();
  try {
    process.chdir(workspacePath);
    const config = await Config.create(Config.getDefaultOptions());
    config.unset(OrgConfigProperties.TARGET_ORG);
    await config.write();
    await updateConfigAndStateAggregators();
  } finally {
    process.chdir(originalDirectory);
  }
};

/** Sets the target org or alias in the local config */
export const setTargetOrgOrAlias = async (usernameOrAlias: string): Promise<void> => {
  const { Org } = await import('@salesforce/core');

  const originalDirectory = process.cwd();
  // In order to correctly setup Config, the process directory needs to be set to the current workspace directory
  const workspacePath = workspaceUtils.getRootWorkspacePath();
  try {
    // checks if the usernameOrAlias is non-empty and active.
    if (usernameOrAlias) {
      // throws an error if the org associated with the usernameOrAlias is expired.
      await Org.create({ aliasOrUsername: usernameOrAlias });
    }
    process.chdir(workspacePath);
    await setUsernameOrAlias(usernameOrAlias);
  } finally {
    process.chdir(originalDirectory);
  }
};
