/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthFields, AuthInfo, Connection, StateAggregator, Org } from '@salesforce/core';
import * as vscode from 'vscode';
import { notificationService } from '../commands/notificationService';
import { ConfigSource, ConfigUtil } from '../config/configUtil';
import { nls } from '../messages/messages';
import { telemetryService } from '../services/telemetry';

/** Get the Dev Hub username */
export const getDevHubUsername = async (): Promise<string | undefined> => {
  const targetDevHubOrAlias = await getTargetDevHubOrAlias(false);
  let targetDevHub: string | undefined;
  if (targetDevHubOrAlias) {
    targetDevHub = await getUsername(targetDevHubOrAlias);
  }
  return targetDevHub;
};

/** Get the target org or alias, optionally showing warnings */
export const getTargetOrgOrAlias = async (enableWarning: boolean): Promise<string | undefined> => {
  try {
    const targetOrgOrAlias = await ConfigUtil.getTargetOrgOrAlias();
    if (!targetOrgOrAlias) {
      displayMessage(nls.localize('error_no_target_org'), enableWarning, VSCodeWindowTypeEnum.Informational);
      return undefined;
    } else {
      if (await ConfigUtil.isGlobalTargetOrg()) {
        displayMessage(nls.localize('warning_using_global_username'), enableWarning, VSCodeWindowTypeEnum.Warning);
      }
    }

    return targetOrgOrAlias;
  } catch (err) {
    if (err instanceof Error) {
      telemetryService.sendException('get_target_org_alias', err.message);
    }
    return undefined;
  }
};

/** Get the target Dev Hub or alias, optionally showing warnings */
export const getTargetDevHubOrAlias = async (
  enableWarning: boolean,
  configSource?: ConfigSource.Global | ConfigSource.Local
): Promise<string | undefined> => {
  try {
    const targetDevHub =
      configSource === ConfigSource.Global
        ? await ConfigUtil.getGlobalTargetDevHubOrAlias()
        : await ConfigUtil.getTargetDevHubOrAlias();

    if (!targetDevHub) {
      const showButtonText = nls.localize('notification_make_default_dev');
      const selection = await displayMessage(
        nls.localize('error_no_target_dev_hub'),
        enableWarning,
        VSCodeWindowTypeEnum.Informational,
        [showButtonText]
      );
      if (selection && selection === showButtonText) {
        vscode.commands.executeCommand('sf.org.login.web.dev.hub');
      }
      return undefined;
    }
    return JSON.stringify(targetDevHub).replace(/"/g, '');
  } catch (err) {
    if (err instanceof Error) {
      telemetryService.sendException('get_target_dev_hub_alias', err.message);
    }
    return undefined;
  }
};

/** Get the username for an org alias or username */
export const getUsername = async (usernameOrAlias: string): Promise<string> => {
  const info = await StateAggregator.getInstance();
  return info.aliases.getUsername(usernameOrAlias) ?? usernameOrAlias;
};

/** Check if an org is a scratch org */
export const isAScratchOrg = async (username: string): Promise<boolean> => {
  const authInfo = await AuthInfo.create({ username });
  const org: Org = await Org.create({
    connection: await Connection.create({
      authInfo
    })
  });
  if (org.isScratch()) {
    return true;
  }
  const authInfoFields = authInfo.getFields();
  return !!authInfoFields.devHubUsername || false;
};

/** Check if an org is a sandbox org */
export const isASandboxOrg = async (username: string): Promise<boolean> => {
  const authInfo = await AuthInfo.create({ username });
  const org: Org = await Org.create({
    connection: await Connection.create({
      authInfo
    })
  });
  if (await org.isSandbox()) {
    return true;
  }
  // scratch org also makes IsSandbox true
  const result = await org
    .getConnection()
    .singleRecordQuery<{ IsSandbox: boolean }>('select IsSandbox from organization');
  return result?.IsSandbox;
};

/** Get the Dev Hub ID for a scratch org */
export const getDevHubIdFromScratchOrg = async (username: string): Promise<string | undefined> => {
  if (await isAScratchOrg(username)) {
    const scratchOrg: Org = await Org.create({
      connection: await Connection.create({
        authInfo: await AuthInfo.create({ username })
      })
    });
    const devHubOrg = await scratchOrg.getDevHubOrg();
    return devHubOrg?.getOrgId();
  } else return undefined;
};

/** Get a connection for an org */
export const getConnection = async (usernameOrAlias?: string): Promise<Connection> => {
  let _usernameOrAlias;

  if (usernameOrAlias) {
    _usernameOrAlias = usernameOrAlias;
  } else {
    const defaultName = await getTargetOrgOrAlias(true);
    if (!defaultName) {
      throw new Error(nls.localize('error_no_target_org'));
    }
    _usernameOrAlias = defaultName;
  }

  const username = await getUsername(_usernameOrAlias);

  return await Connection.create({
    authInfo: await AuthInfo.create({ username })
  });
};

/** Get auth fields for a connection */
export const getAuthFields = (connection: Connection): AuthFields => connection.getAuthInfoFields();

enum VSCodeWindowTypeEnum {
  Error = 1,
  Informational = 2,
  Warning = 3
}

const displayMessage = (
  output: string,
  enableWarning?: boolean,
  vsCodeWindowType?: VSCodeWindowTypeEnum,
  items?: string[]
): Thenable<string | undefined> | undefined => {
  if (enableWarning !== undefined && !enableWarning) {
    return;
  }
  const buttons = items ?? [];
  if (vsCodeWindowType) {
    switch (vsCodeWindowType) {
      case VSCodeWindowTypeEnum.Error: {
        return notificationService.showErrorMessage(output, ...buttons);
      }
      case VSCodeWindowTypeEnum.Informational: {
        return notificationService.showInformationMessage(output, ...buttons);
      }
      case VSCodeWindowTypeEnum.Warning: {
        return notificationService.showWarningMessage(output, ...buttons);
      }
    }
  }
};
