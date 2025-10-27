/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthFields, AuthInfo, Connection, StateAggregator, Org } from '@salesforce/core';
import * as vscode from 'vscode';
import { ConfigSource, ConfigUtil } from '../config/configUtil';

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
        if (enableWarning) {
          // Caller should handle displaying the message
          console.log('No target org is set');
        }
        return undefined;
      } else {
        if (await ConfigUtil.isGlobalTargetOrg()) {
          if (enableWarning) {
            console.log('Using global target org');
          }
        }
      }

      return targetOrgOrAlias;
    } catch (err) {
      console.error(err);
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
        if (enableWarning) {
          // Show error with option to authorize Dev Hub
          const showButtonText = 'Authorize a Dev Hub';
          const selection = await vscode.window.showErrorMessage(
            'No target Dev Hub is set. Run "SFDX: Authorize a Dev Hub" to set one.',
            showButtonText
          );
          if (selection && selection === showButtonText) {
            await vscode.commands.executeCommand('sf.org.login.web.dev.hub');
          }
        }
        return undefined;
      }
      return JSON.stringify(targetDevHub).replace(/"/g, '');
    } catch (err) {
      console.error(err);
      return undefined;
    }
  }

  /** Get the username from a username or alias */
  public static async getUsername(usernameOrAlias: string): Promise<string> {
    const info = await StateAggregator.getInstance();
    return info.aliases.getUsername(usernameOrAlias) ?? usernameOrAlias;
  }

  /** Check if an org is a scratch org */
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

  /** Check if an org is a sandbox */
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

  /** Get the Dev Hub ID from a scratch org */
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

  /** Get a connection for a username or alias */
  public static async getConnection(usernameOrAlias?: string): Promise<Connection> {
    let _usernameOrAlias;

    if (usernameOrAlias) {
      _usernameOrAlias = usernameOrAlias;
    } else {
      const defaultName = await OrgAuthInfo.getTargetOrgOrAlias(true);
      if (!defaultName) {
        throw new Error('No default org is set');
      }
      _usernameOrAlias = defaultName;
    }

    const username = await this.getUsername(_usernameOrAlias);

    return await Connection.create({
      authInfo: await AuthInfo.create({ username })
    });
  }

  /** Get auth fields for a connection */
  public static async getAuthFields(connection: Connection): Promise<AuthFields> {
    return connection.getAuthInfoFields();
  }
}
