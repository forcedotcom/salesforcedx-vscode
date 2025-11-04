/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthFields, AuthInfo, Connection, StateAggregator, Org } from '@salesforce/core';
import * as vscode from 'vscode';
import { notificationService } from '../commands';
import { ConfigSource, ConfigUtil } from '../config/configUtil';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';

/** Utility class for working with Salesforce org authentication */
export class OrgAuthInfo {
  /** Get the Dev Hub username */
  public static async getDevHubUsername(): Promise<string | undefined> {
    const targetDevHubOrAlias = await OrgAuthInfo.getTargetDevHubOrAlias(false);
    let targetDevHub: string | undefined;
    if (targetDevHubOrAlias) {
      targetDevHub = await OrgAuthInfo.getUsername(targetDevHubOrAlias);
    }
    return targetDevHub;
  }

  /** Get the target org or alias, optionally showing warnings */
  public static async getTargetOrgOrAlias(enableWarning: boolean): Promise<string | undefined> {
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
  }

  /** Get the target Dev Hub or alias, optionally showing warnings */
  public static async getTargetDevHubOrAlias(
    enableWarning: boolean,
    configSource?: ConfigSource.Global | ConfigSource.Local
  ): Promise<string | undefined> {
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
  }

  public static async getUsername(usernameOrAlias: string): Promise<string> {
    const info = await StateAggregator.getInstance();
    return info.aliases.getUsername(usernameOrAlias) ?? usernameOrAlias;
  }

  public static async isAScratchOrg(username: string): Promise<boolean> {
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
  }

  public static async isASandboxOrg(username: string): Promise<boolean> {
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
  }

  public static async getDevHubIdFromScratchOrg(username: string): Promise<string | undefined> {
    if (await this.isAScratchOrg(username)) {
      const scratchOrg: Org = await Org.create({
        connection: await Connection.create({
          authInfo: await AuthInfo.create({ username })
        })
      });
      const devHubOrg = await scratchOrg.getDevHubOrg();
      return devHubOrg?.getOrgId();
    } else return undefined;
  }

  public static async getConnection(usernameOrAlias?: string): Promise<Connection> {
    let _usernameOrAlias;

    if (usernameOrAlias) {
      _usernameOrAlias = usernameOrAlias;
    } else {
      const defaultName = await OrgAuthInfo.getTargetOrgOrAlias(true);
      if (!defaultName) {
        throw new Error(nls.localize('error_no_target_org'));
      }
      _usernameOrAlias = defaultName;
    }

    const username = await this.getUsername(_usernameOrAlias);

    return await Connection.create({
      authInfo: await AuthInfo.create({ username })
    });
  }

  /** Get auth fields for a connection */
  public static getAuthFields(connection: Connection): AuthFields {
    return connection.getAuthInfoFields();
  }
}

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
