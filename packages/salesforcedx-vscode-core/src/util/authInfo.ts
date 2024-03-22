/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection, StateAggregator } from '@salesforce/core';
import {
  ConfigSource,
  ConfigUtil
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { WorkspaceContext } from '../context';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { telemetryService } from '../telemetry';

export class OrgAuthInfo {
  public static async getDevHubUsername() {
    const defaultDevHubUsernameOrAlias =
      await OrgAuthInfo.getDefaultDevHubUsernameOrAlias(false);
    let defaultDevHubUsername: string | undefined;
    if (defaultDevHubUsernameOrAlias) {
      defaultDevHubUsername = await OrgAuthInfo.getUsername(
        defaultDevHubUsernameOrAlias
      );
    }
    return defaultDevHubUsername;
  }

  public static async getDefaultUsernameOrAlias(
    enableWarning: boolean
  ): Promise<string | undefined> {
    try {
      const defaultUsernameOrAlias =
        await ConfigUtil.getDefaultUsernameOrAlias();
      if (!defaultUsernameOrAlias) {
        displayMessage(
          nls.localize('error_no_default_username'),
          enableWarning,
          VSCodeWindowTypeEnum.Informational
        );
        return undefined;
      } else {
        if (await ConfigUtil.isGlobalDefaultUsername()) {
          displayMessage(
            nls.localize('warning_using_global_username'),
            enableWarning,
            VSCodeWindowTypeEnum.Warning
          );
        }
      }

      return defaultUsernameOrAlias;
    } catch (err) {
      console.error(err);
      if (err instanceof Error) {
        telemetryService.sendException(
          'get_default_username_alias',
          err.message
        );
      }
      return undefined;
    }
  }

  public static async getDefaultDevHubUsernameOrAlias(
    enableWarning: boolean,
    configSource?: ConfigSource.Global | ConfigSource.Local
  ): Promise<string | undefined> {
    try {
      const defaultDevHubUserName =
        configSource === ConfigSource.Global
          ? await ConfigUtil.getGlobalDefaultDevHubUsernameOrAlias()
          : await ConfigUtil.getDefaultDevHubUsernameOrAlias();

      if (!defaultDevHubUserName) {
        const showButtonText = nls.localize('notification_make_default_dev');
        const selection = await displayMessage(
          nls.localize('error_no_default_devhubusername'),
          enableWarning,
          VSCodeWindowTypeEnum.Informational,
          [showButtonText]
        );
        if (selection && selection === showButtonText) {
          vscode.commands.executeCommand('sfdx.org.login.web.dev.hub');
        }
        return undefined;
      }
      return JSON.stringify(defaultDevHubUserName).replace(/"/g, '');
    } catch (err) {
      console.error(err);
      if (err instanceof Error) {
        telemetryService.sendException(
          'get_default_devhub_username_alias',
          err.message
        );
      }
      return undefined;
    }
  }

  public static async getUsername(usernameOrAlias: string): Promise<string> {
    const info = await StateAggregator.getInstance();
    return info.aliases.getUsername(usernameOrAlias) || usernameOrAlias;
  }

  public static async isAScratchOrg(username: string): Promise<boolean> {
    const authInfo = await AuthInfo.create({ username });
    const authInfoFields = authInfo.getFields();
    return Promise.resolve(
      typeof authInfoFields.devHubUsername !== 'undefined'
    );
  }

  public static async isAProductionOrg(username: string): Promise<boolean> {
    const authInfo = await AuthInfo.create({ username });
    const authInfoFields = authInfo.getFields();
    return Promise.resolve(
      !authInfoFields.isSandbox &&
        !authInfoFields.instanceUrl?.includes('sandbox.my.salesforce.com')
    );
  }

  public static async getConnection(
    usernameOrAlias?: string
  ): Promise<Connection> {
    let _usernameOrAlias;

    if (usernameOrAlias) {
      _usernameOrAlias = usernameOrAlias;
    } else {
      const defaultName = await OrgAuthInfo.getDefaultUsernameOrAlias(true);
      if (!defaultName) {
        throw new Error(nls.localize('error_no_default_username'));
      }
      _usernameOrAlias = defaultName;
    }

    const username = await this.getUsername(_usernameOrAlias);

    return await Connection.create({
      authInfo: await AuthInfo.create({ username })
    });
  }

  public static async getOrgApiVersion(): Promise<string | undefined> {
    const connection = await WorkspaceContext.getInstance().getConnection();
    const apiVersion = connection.getApiVersion();
    return apiVersion ? String(apiVersion) : undefined;
  }
}

enum VSCodeWindowTypeEnum {
  Error = 1,
  Informational = 2,
  Warning = 3
}

function displayMessage(
  output: string,
  enableWarning?: boolean,
  vsCodeWindowType?: VSCodeWindowTypeEnum,
  items?: string[]
) {
  if (enableWarning !== undefined && !enableWarning) {
    return;
  }
  const buttons = items || [];
  channelService.appendLine(output);
  channelService.showChannelOutput();
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
}
